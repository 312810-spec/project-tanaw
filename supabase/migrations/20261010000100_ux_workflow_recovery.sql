-- Explicit scope requirements, expiry recovery and governed review safeguards.
-- No official indicators, assignments or formulas are seeded.
alter table public.tanaw_submission_slots add column required_indicator_ids uuid[],
 add column requirements_revision integer not null default 0 check(requirements_revision>=0);
alter table public.tanaw_district_decisions add column decision_revision bigint generated always as identity;

create or replace function tanaw_private.slot_complete(target_slot uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select cardinality(sl.required_indicator_ids)>0 and sub.current_version>0
 and not exists(select 1 from unnest(sl.required_indicator_ids) required(id)
  where not exists(select 1 from public.smea_indicator_definitions d
   join public.tanaw_reporting_cycles c on c.id=sl.cycle_id
   join public.tanaw_instructional_blocks b on b.id=c.instructional_block_id
   where d.id=required.id and d.school_id=sl.school_id and d.definition_status='verified'
    and d.school_year=b.school_year and d.reporting_period=b.label)
  or not exists(select 1 from jsonb_array_elements(v.evidence->'entries') e
   where e->>'definitionId'=required.id::text and jsonb_typeof(e->'value')='number'
    and nullif(btrim(e->>'sourceTitle'),'') is not null and nullif(btrim(e->>'sourceLocator'),'') is not null))
 from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id
 left join public.tanaw_submission_versions v on v.submission_id=sub.id and v.version=sub.current_version
 where sl.id=target_slot),false);
$$;
revoke all on function tanaw_private.slot_complete(uuid) from public,anon,authenticated;

create function public.tanaw_set_slot_requirements(target_submission uuid,expected_version integer,indicator_ids uuid[],change_reason text,expected_requirements_revision integer default 0)
returns void language plpgsql security definer set search_path='' as $$
declare sl public.tanaw_submission_slots; c public.tanaw_reporting_cycles; sub public.tanaw_submissions;
begin
 select s.* into sl from public.tanaw_submission_slots s join public.tanaw_submissions v on v.slot_id=s.id where v.id=target_submission;
 select * into c from public.tanaw_reporting_cycles where id=sl.cycle_id for update;
 if not found or not tanaw_private.has_school_role(c.school_id,array['smeaCoordinator']) then raise exception 'Coordinator required' using errcode='42501'; end if;
 if c.locked_at is not null and tanaw_private.open_amendment(c.id) is null then raise exception 'Active amendment required' using errcode='42501'; end if;
 select * into sl from public.tanaw_submission_slots where id=sl.id;
 select * into sub from public.tanaw_submissions where id=target_submission;
 if expected_version is null or expected_version<>sub.current_version or expected_requirements_revision is null or expected_requirements_revision<>sl.requirements_revision then raise exception 'Version or requirements conflict' using errcode='40001'; end if;
 if indicator_ids is null or cardinality(indicator_ids)=0 or cardinality(indicator_ids)>200
 or cardinality(indicator_ids)<>(select count(distinct id) from unnest(indicator_ids) t(id))
 or nullif(btrim(change_reason),'') is null then raise exception 'Distinct required indicators and reason required' using errcode='22023'; end if;
 if exists(select 1 from unnest(indicator_ids) t(id) where not exists(select 1 from public.smea_indicator_definitions d join public.tanaw_instructional_blocks b on b.id=c.instructional_block_id where d.id=t.id and d.school_id=sl.school_id and d.definition_status='verified' and d.school_year=b.school_year and d.reporting_period=b.label)) then raise exception 'Verified period indicators required' using errcode='22023'; end if;
 update public.tanaw_submission_slots set required_indicator_ids=indicator_ids,requirements_revision=requirements_revision+1 where id=sl.id;
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),'setRequirements',sl.id,change_reason);
end; $$;
revoke all on function public.tanaw_set_slot_requirements(uuid,integer,uuid[],text,integer) from public,anon,authenticated;
grant execute on function public.tanaw_set_slot_requirements(uuid,integer,uuid[],text,integer) to authenticated;


create or replace function tanaw_private.cycle_manifest(target_cycle uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('slot',s.id,'submission',v.id,'version',v.current_version,'requiredIndicators',s.required_indicator_ids,'requirementsRevision',s.requirements_revision,'coverageComplete',tanaw_private.slot_complete(s.id)) order by s.id),'[]'::jsonb)
 from public.tanaw_submission_slots s left join public.tanaw_submissions v on v.slot_id=s.id
 where s.cycle_id=target_cycle;
$$;

create or replace function public.tanaw_open_amendment(target_cycle uuid,amendment_deadline timestamptz,change_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.tanaw_reporting_cycles; result uuid;
begin
 select * into c from public.tanaw_reporting_cycles where id=target_cycle for update;
 if not found or not tanaw_private.has_school_role(c.school_id,array['smeaCoordinator']) then raise exception 'Coordinator required' using errcode='42501'; end if;
 if c.locked_at is null or amendment_deadline is null or not isfinite(amendment_deadline) or amendment_deadline<=clock_timestamp() or nullif(btrim(change_reason),'') is null then raise exception 'Locked cycle, future deadline and reason required' using errcode='22023'; end if;
 update public.tanaw_amendment_rounds set closed_at=clock_timestamp() where cycle_id=c.id and closed_at is null and deadline_at<=clock_timestamp();
 if exists(select 1 from public.tanaw_amendment_rounds where cycle_id=c.id and closed_at is null) then raise exception 'An amendment round is already open' using errcode='22023'; end if;
 insert into public.tanaw_amendment_rounds(cycle_id,deadline_at,reason,created_by) values(c.id,amendment_deadline,change_reason,auth.uid()) returning id into result;
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),'openAmendment',result,change_reason);
 return result;
end; $$;

create or replace function public.tanaw_prepare_packet(target_cycle uuid,missing_reasons jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.tanaw_reporting_cycles; result uuid; next_version integer; missing_count integer; item jsonb; ids uuid[]='{}'; missing_slot uuid;
begin
 select * into c from public.tanaw_reporting_cycles where id=target_cycle for update;
 if not found or not tanaw_private.has_school_role(c.school_id,array['smeaCoordinator']) then raise exception 'Coordinator required' using errcode='42501'; end if;
 if c.locked_at is not null and tanaw_private.open_amendment(c.id) is null then raise exception 'Locked packet requires an active amendment' using errcode='42501'; end if;
 if jsonb_typeof(missing_reasons) is distinct from 'array' then raise exception 'Missing reasons array required' using errcode='22023'; end if;
 if not exists(select 1 from public.tanaw_submission_slots where cycle_id=c.id) then raise exception 'Assignments required' using errcode='22023'; end if;
 if exists(select 1 from public.tanaw_submission_slots where cycle_id=c.id and coalesce(cardinality(required_indicator_ids),0)=0) then raise exception 'Configure required indicators for every assignment' using errcode='22023'; end if;
 if exists(select 1 from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id where sl.cycle_id=c.id and sub.current_version>0 and not exists(select 1 from public.tanaw_submission_reviews r where r.submission_id=sub.id and r.version=sub.current_version)) then raise exception 'Required subject review missing' using errcode='42501'; end if;
 for item in select value from jsonb_array_elements(missing_reasons) loop
  missing_slot=(item->>'slotId')::uuid;
  if missing_slot is null or missing_slot=any(ids) or nullif(btrim(item->>'reason'),'') is null or not exists(select 1 from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id where sl.id=missing_slot and sl.cycle_id=c.id and not tanaw_private.slot_complete(sl.id)) then raise exception 'Distinct missing assignment reason required' using errcode='22023'; end if;
  ids=array_append(ids,missing_slot);
 end loop;
 select count(*) into missing_count from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id where sl.cycle_id=c.id and not tanaw_private.slot_complete(sl.id);
 if cardinality(ids)<>missing_count then raise exception 'Every missing submission needs a reason' using errcode='22023'; end if;
 select coalesce(max(version),0)+1 into next_version from public.tanaw_school_packets where cycle_id=c.id;
 insert into public.tanaw_school_packets(cycle_id,school_id,version,prepared_by,amendment_round_id,manifest,missing) values(c.id,c.school_id,next_version,auth.uid(),tanaw_private.open_amendment(c.id),tanaw_private.cycle_manifest(c.id),missing_reasons) returning id into result;
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),'preparePacket',result,'Packet prepared for school review');
 return result;
end; $$;

create or replace function public.tanaw_review_submission(target_submission uuid,expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare s public.tanaw_submission_slots; c public.tanaw_reporting_cycles; v public.tanaw_submissions;
begin
 select sl.* into s from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id where sub.id=target_submission;
 select * into c from public.tanaw_reporting_cycles where id=s.cycle_id for update;
 if not found or not exists(select 1 from public.tanaw_memberships m where school_id=c.school_id and user_id=auth.uid() and active and 'subjectCoordinator'=any(roles) and s.subject_id=any(subject_ids)) or s.author_id=auth.uid() then raise exception 'Independent assigned subject reviewer required' using errcode='42501'; end if;
 select * into v from public.tanaw_submissions where id=target_submission;
 if c.locked_at is not null and tanaw_private.open_amendment(c.id) is null then raise exception 'Locked cycle' using errcode='42501'; end if;
 if expected_version is null or v.current_version=0 or expected_version<>v.current_version then raise exception 'Current submitted version required' using errcode='40001'; end if;
 if exists(select 1 from public.tanaw_submission_reviews where submission_id=v.id and version=v.current_version and stage='subject') then return; end if;
 insert into public.tanaw_submission_reviews(submission_id,version,stage,reviewer_id,self_review) values(v.id,v.current_version,'subject',auth.uid(),false);
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),'subjectReview',v.id,'Subject review recorded');
end; $$;

create or replace function public.tanaw_review_packet(target_packet uuid,review_stage text,acknowledge_missing boolean)
returns void language plpgsql security definer set search_path='' as $$
declare p public.tanaw_school_packets; c public.tanaw_reporting_cycles; own_submission boolean;
begin
 select * into p from public.tanaw_school_packets where id=target_packet;
 select * into c from public.tanaw_reporting_cycles where id=p.cycle_id for update;
 if not found or review_stage is null or review_stage not in ('school','head') or not tanaw_private.has_school_role(c.school_id,case when review_stage='school' then array['smeaCoordinator'] else array['schoolHead'] end) then raise exception 'School review role required' using errcode='42501'; end if;
 if p.locked_at is not null or (c.locked_at is not null and (p.amendment_round_id is null or p.amendment_round_id is distinct from tanaw_private.open_amendment(c.id))) then raise exception 'Locked packet' using errcode='42501'; end if;
 if p.manifest<>tanaw_private.cycle_manifest(c.id) or p.version<>(select max(version) from public.tanaw_school_packets where cycle_id=c.id) then raise exception 'Stale packet requires new reviews' using errcode='40001'; end if;
 select exists(select 1 from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id where sl.cycle_id=c.id and sl.author_id=auth.uid() and sub.current_version>0) into own_submission;
 if review_stage='head' and (own_submission or p.prepared_by=auth.uid()) then raise exception 'Independent Head review required' using errcode='42501'; end if;
 if review_stage='head' and not exists(select 1 from public.tanaw_packet_reviews where packet_id=p.id and stage='school') then raise exception 'School review required first' using errcode='42501'; end if;
 if review_stage='head' and jsonb_array_length(p.missing)>0 and acknowledge_missing is distinct from true then raise exception 'Head must acknowledge missing submissions' using errcode='22023'; end if;
 if exists(select 1 from public.tanaw_packet_reviews where packet_id=p.id and stage=review_stage) then return; end if;
 insert into public.tanaw_packet_reviews(packet_id,stage,reviewer_id,self_review,acknowledged_missing) values(p.id,review_stage,auth.uid(),p.prepared_by=auth.uid() or own_submission,coalesce(acknowledge_missing,false));
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),review_stage||'Review',p.id,'Packet review recorded');
end; $$;

create or replace function public.tanaw_district_review(target_packet uuid,decision text,review_comment text) returns void
language plpgsql security definer set search_path='' as $$
begin
 raise exception 'Refresh the application to use district request reconciliation' using errcode='22023';
end; $$;

-- School feedback exposes packet decisions without widening raw-evidence access.
create function public.tanaw_school_feedback(target_cycle uuid)
returns table(packet_version integer,action text,comment text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare school uuid;
begin
 select school_id into school from public.tanaw_reporting_cycles where id=target_cycle;
 if not found or not tanaw_private.has_school_role(school,array['teacher','subjectCoordinator','smeaCoordinator','schoolHead','districtCoordinator']) then raise exception 'Assigned school account required' using errcode='42501'; end if;
 return query select p.version,d.action,d.comment,d.created_at from public.tanaw_district_decisions d join public.tanaw_school_packets p on p.id=d.packet_id where p.cycle_id=target_cycle order by d.decision_revision desc limit 100;
end; $$;
revoke all on function public.tanaw_school_feedback(uuid) from public,anon,authenticated;
grant execute on function public.tanaw_school_feedback(uuid) to authenticated;

-- Durable request identity reconciles an interrupted district response.
alter table public.tanaw_district_decisions add column request_id uuid;
create unique index tanaw_district_request on public.tanaw_district_decisions(packet_id,reviewer_id,request_id) where request_id is not null;
create function public.tanaw_district_review_request(target_packet uuid,decision text,review_comment text,request_id uuid,expected_decision_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p public.tanaw_school_packets; existing public.tanaw_district_decisions; latest public.tanaw_district_decisions; latest_id uuid;
begin
 select * into p from public.tanaw_school_packets where id=target_packet for update;
 if not found or not tanaw_private.has_school_role(p.school_id,array['districtCoordinator']) then raise exception 'Assigned district reviewer required' using errcode='42501'; end if;
 if p.locked_at is null or request_id is null or decision is distinct from 'return' or nullif(btrim(review_comment),'') is null then raise exception 'Locked packet, request identity and return comment required; acceptance awaits governed results' using errcode='22023'; end if;
 select * into existing from public.tanaw_district_decisions d where d.packet_id=p.id and d.reviewer_id=auth.uid() and d.request_id=tanaw_district_review_request.request_id;
 if found then
  if existing.action<>decision or existing.comment<>review_comment then raise exception 'Request identity payload conflict' using errcode='40001'; end if;
  return;
 end if;
 select * into latest from public.tanaw_district_decisions where packet_id=p.id order by decision_revision desc limit 1;
 latest_id=latest.id;
 if latest_id is distinct from expected_decision_id then raise exception 'District decision changed; refresh feedback' using errcode='40001'; end if;
 if latest.reviewer_id=auth.uid() and latest.action=decision and latest.comment=review_comment then return; end if;
 insert into public.tanaw_district_decisions(packet_id,reviewer_id,action,comment,request_id) values(p.id,auth.uid(),decision,review_comment,request_id);
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(p.school_id,p.cycle_id,auth.uid(),'districtreturn',p.id,review_comment);
end; $$;
revoke all on function public.tanaw_district_review_request(uuid,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.tanaw_district_review_request(uuid,text,text,uuid,uuid) to authenticated;
