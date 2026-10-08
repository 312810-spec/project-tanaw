-- Local-only workflow. No actual assignments, evidence, people or approvals seeded.
create table public.tanaw_submission_slots (
 id uuid primary key default gen_random_uuid(),
 cycle_id uuid not null references public.tanaw_reporting_cycles(id) on delete restrict,
 school_id uuid not null references public.tanaw_schools(id) on delete restrict,
 author_id uuid not null references auth.users(id) on delete restrict,
 subject_id text not null check (nullif(btrim(subject_id),'') is not null),
 scope_label text not null check (nullif(btrim(scope_label),'') is not null),
 created_by uuid not null references auth.users(id) on delete restrict,
 unique(cycle_id,author_id,subject_id,scope_label)
);
create table public.tanaw_submissions (
 id uuid primary key default gen_random_uuid(),
 slot_id uuid not null unique references public.tanaw_submission_slots(id) on delete restrict,
 current_version integer not null default 0 check(current_version>=0),
 extension_until timestamptz check(extension_until is null or isfinite(extension_until)),
 extension_reason text,
 check((extension_until is null and extension_reason is null) or (extension_until is not null and nullif(btrim(extension_reason),'') is not null))
);
create table public.tanaw_submission_versions (
 submission_id uuid not null references public.tanaw_submissions(id) on delete restrict,
 version integer not null check(version>0),
 evidence jsonb not null check(jsonb_typeof(evidence)='object'),
 author_id uuid not null references auth.users(id) on delete restrict,
 recorded_by uuid not null references auth.users(id) on delete restrict,
 reason text not null check(nullif(btrim(reason),'') is not null),
 created_at timestamptz not null default now(),
 primary key(submission_id,version)
);
create table public.tanaw_submission_reviews (
 submission_id uuid not null,
 version integer not null,
 stage text not null check(stage='subject'),
 reviewer_id uuid not null references auth.users(id) on delete restrict,
 self_review boolean not null check(not self_review),
 created_at timestamptz not null default now(),
 primary key(submission_id,version,stage),
 foreign key(submission_id,version) references public.tanaw_submission_versions(submission_id,version) on delete restrict
);
create table public.tanaw_amendment_rounds (
 id uuid primary key default gen_random_uuid(),
 cycle_id uuid not null references public.tanaw_reporting_cycles(id) on delete restrict,
 deadline_at timestamptz not null check(isfinite(deadline_at)),
 reason text not null check(nullif(btrim(reason),'') is not null),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 closed_at timestamptz
);
create unique index tanaw_one_open_amendment on public.tanaw_amendment_rounds(cycle_id) where closed_at is null;
create table public.tanaw_school_packets (
 id uuid primary key default gen_random_uuid(),
 cycle_id uuid not null references public.tanaw_reporting_cycles(id) on delete restrict,
 school_id uuid not null references public.tanaw_schools(id) on delete restrict,
 version integer not null check(version>0),
 prepared_by uuid not null references auth.users(id) on delete restrict,
 amendment_round_id uuid references public.tanaw_amendment_rounds(id) on delete restrict,
 manifest jsonb not null,
 missing jsonb not null,
 locked_at timestamptz,
 completeness text check(completeness in ('complete','incomplete')),
 created_at timestamptz not null default now(),
 unique(cycle_id,version)
);
create table public.tanaw_packet_reviews (
 packet_id uuid not null references public.tanaw_school_packets(id) on delete restrict,
 stage text not null check(stage in ('school','head')),
 reviewer_id uuid not null references auth.users(id) on delete restrict,
 self_review boolean not null,
 acknowledged_missing boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(packet_id,stage),
 check(stage<>'head' or not self_review)
);
create table public.tanaw_district_decisions (
 id uuid primary key default gen_random_uuid(),
 packet_id uuid not null references public.tanaw_school_packets(id) on delete restrict,
 reviewer_id uuid not null references auth.users(id) on delete restrict,
 action text not null check(action in ('accept','return')),
 comment text not null,
 created_at timestamptz not null default now(),
 check(action<>'return' or nullif(btrim(comment),'') is not null)
);
create table public.tanaw_workflow_events (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.tanaw_schools(id) on delete restrict,
 cycle_id uuid not null references public.tanaw_reporting_cycles(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 action text not null,
 target_id uuid not null,
 reason text not null check(nullif(btrim(reason),'') is not null),
 occurred_at timestamptz not null default now()
);

-- Raw access follows the stored slot, not browser-selected roles or request authors.
create function tanaw_private.can_read_slot(target_slot uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tanaw_submission_slots s join public.tanaw_memberships m
  on m.school_id=s.school_id and m.user_id=auth.uid() and m.active
  where s.id=target_slot and (
   m.roles && array['smeaCoordinator','schoolHead']
   or ('teacher'=any(m.roles) and s.author_id=auth.uid())
   or ('subjectCoordinator'=any(m.roles) and s.subject_id=any(m.subject_ids))
  ));
$$;
revoke all on function tanaw_private.can_read_slot(uuid) from public,anon,authenticated;
grant execute on function tanaw_private.can_read_slot(uuid) to authenticated;

-- A single cycle row lock serializes submission edits, packet reviews and Lock.
-- It is acquired before checking deadline/version/manifest, preventing TOCTOU.
create function tanaw_private.cycle_manifest(target_cycle uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('slot',s.id,'submission',v.id,'version',v.current_version) order by s.id),'[]'::jsonb)
 from public.tanaw_submission_slots s left join public.tanaw_submissions v on v.slot_id=s.id
 where s.cycle_id=target_cycle;
$$;
revoke all on function tanaw_private.cycle_manifest(uuid) from public,anon,authenticated;

create function tanaw_private.open_amendment(target_cycle uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select id from public.tanaw_amendment_rounds where cycle_id=target_cycle and closed_at is null and deadline_at>clock_timestamp();
$$;
revoke all on function tanaw_private.open_amendment(uuid) from public,anon,authenticated;
create function tanaw_private.packet_school(target_packet uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select school_id from public.tanaw_school_packets where id=target_packet and tanaw_private.has_school_role(school_id,array['smeaCoordinator','schoolHead','districtCoordinator']);
$$;
revoke all on function tanaw_private.packet_school(uuid) from public,anon,authenticated;
grant execute on function tanaw_private.packet_school(uuid) to authenticated;
create function public.tanaw_open_amendment(target_cycle uuid,amendment_deadline timestamptz,change_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.tanaw_reporting_cycles; result uuid;
begin
 select * into c from public.tanaw_reporting_cycles where id=target_cycle for update;
 if not found or not tanaw_private.has_school_role(c.school_id,array['smeaCoordinator']) then raise exception 'Coordinator required' using errcode='42501'; end if;
 if c.locked_at is null or amendment_deadline is null or not isfinite(amendment_deadline) or amendment_deadline<=clock_timestamp() or nullif(btrim(change_reason),'') is null then raise exception 'Locked cycle, future deadline and reason required' using errcode='22023'; end if;
 if exists(select 1 from public.tanaw_amendment_rounds where cycle_id=c.id and closed_at is null) then raise exception 'An amendment round is already open' using errcode='22023'; end if;
 insert into public.tanaw_amendment_rounds(cycle_id,deadline_at,reason,created_by) values(c.id,amendment_deadline,change_reason,auth.uid()) returning id into result;
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),'openAmendment',result,change_reason);
 return result;
end; $$;
create function public.tanaw_assign_submission(target_cycle uuid,target_author uuid,target_subject text,target_scope text,change_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.tanaw_reporting_cycles; result uuid;
begin
 select * into c from public.tanaw_reporting_cycles where id=target_cycle for update;
 if not found or not tanaw_private.has_school_role(c.school_id,array['smeaCoordinator']) then raise exception 'Coordinator required' using errcode='42501'; end if;
 if c.locked_at is not null then raise exception 'Locked cycle' using errcode='42501'; end if;
 if nullif(btrim(target_subject),'') is null or nullif(btrim(target_scope),'') is null or nullif(btrim(change_reason),'') is null then raise exception 'Assignment and reason required' using errcode='22023'; end if;
 if not exists(select 1 from public.tanaw_memberships where school_id=c.school_id and user_id=target_author and active and (roles && array['smeaCoordinator'] or ('teacher'=any(roles) and target_subject=any(subject_ids)))) then raise exception 'Assigned active author required' using errcode='22023'; end if;
 insert into public.tanaw_submission_slots(cycle_id,school_id,author_id,subject_id,scope_label,created_by)
 values(c.id,c.school_id,target_author,btrim(target_subject),btrim(target_scope),auth.uid()) returning id into result;
 insert into public.tanaw_submissions(slot_id) values(result);
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),'assign',result,change_reason);
 return result;
end; $$;

-- Manual indicator evidence only. XLSX submission remains closed until its
-- server-side approved template parser and computation verification are wired.
create function public.tanaw_submit_evidence(target_submission uuid,expected_version integer,new_evidence jsonb,change_reason text)
returns integer language plpgsql security definer set search_path='' as $$
declare s public.tanaw_submission_slots; c public.tanaw_reporting_cycles; v public.tanaw_submissions; item jsonb; def public.smea_indicator_definitions; new_version integer; seen uuid[]='{}';
begin
 select sl.* into s from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id where sub.id=target_submission;
 select * into c from public.tanaw_reporting_cycles where id=s.cycle_id for update;
 if not found or not tanaw_private.can_read_slot(s.id) or not (
 tanaw_private.has_school_role(s.school_id,array['smeaCoordinator']) or (s.author_id=auth.uid() and exists(select 1 from public.tanaw_memberships m where m.school_id=s.school_id and m.user_id=auth.uid() and m.active and 'teacher'=any(m.roles) and s.subject_id=any(m.subject_ids)))) then raise exception 'Submission author or coordinator required' using errcode='42501'; end if;
 select * into v from public.tanaw_submissions where id=target_submission for update;
 if c.locked_at is not null and tanaw_private.open_amendment(c.id) is null then raise exception 'Locked packet requires an active amendment' using errcode='42501'; end if;
 if c.locked_at is null and clock_timestamp()>=greatest(c.deadline_at,coalesce(v.extension_until,c.deadline_at)) then raise exception 'Deadline closed' using errcode='42501'; end if;
 if expected_version is null or expected_version<>v.current_version then raise exception 'Version conflict' using errcode='40001'; end if;
 if nullif(btrim(change_reason),'') is null or new_evidence is null or jsonb_typeof(new_evidence)<>'object'
 or new_evidence->>'kind' is distinct from 'manualIndicators' or jsonb_typeof(new_evidence->'entries') is distinct from 'array' then raise exception 'Manual evidence and reason required' using errcode='22023'; end if;
 if length(new_evidence::text)>524288 then raise exception 'Evidence too large' using errcode='22023'; end if;
 if jsonb_array_length(new_evidence->'entries')=0 or jsonb_array_length(new_evidence->'entries')>200 then raise exception 'Invalid indicator entries' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(new_evidence->'entries') loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'value') is distinct from 'number' or nullif(btrim(item->>'sourceLocator'),'') is null or nullif(btrim(item->>'sourceTitle'),'') is null then raise exception 'Complete recorded value and provenance required' using errcode='22023'; end if;
  select * into def from public.smea_indicator_definitions where id=(item->>'definitionId')::uuid and school_id=s.school_id and definition_status='verified' and (school_year,reporting_period)=(select school_year,label from public.tanaw_instructional_blocks where id=c.instructional_block_id);
  if not found or def.id=any(seen) then raise exception 'Verified distinct school indicator required' using errcode='22023'; end if;
  seen=array_append(seen,def.id);
 end loop;
 new_version=v.current_version+1;
 insert into public.tanaw_submission_versions(submission_id,version,evidence,author_id,recorded_by,reason) values(v.id,new_version,new_evidence,s.author_id,auth.uid(),change_reason);
 update public.tanaw_submissions set current_version=new_version where id=v.id;
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),'submitVersion',v.id,change_reason);
 return new_version;
end; $$;

create function public.tanaw_extend_submission(target_submission uuid,until_time timestamptz,change_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare s public.tanaw_submission_slots; c public.tanaw_reporting_cycles;
begin
 select sl.* into s from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id where sub.id=target_submission;
 select * into c from public.tanaw_reporting_cycles where id=s.cycle_id for update;
 if not found or not tanaw_private.has_school_role(c.school_id,array['smeaCoordinator']) then raise exception 'Coordinator required' using errcode='42501'; end if;
 if c.locked_at is not null then raise exception 'Locked cycle' using errcode='42501'; end if;
 if until_time is null or not isfinite(until_time) or until_time<=clock_timestamp() or until_time<=c.deadline_at or nullif(btrim(change_reason),'') is null then raise exception 'Future extension and reason required' using errcode='22023'; end if;
 update public.tanaw_submissions set extension_until=until_time,extension_reason=change_reason where id=target_submission;
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),'extension',target_submission,change_reason);
end; $$;

create function public.tanaw_review_submission(target_submission uuid,expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare s public.tanaw_submission_slots; c public.tanaw_reporting_cycles; v public.tanaw_submissions;
begin
 select sl.* into s from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id where sub.id=target_submission;
 select * into c from public.tanaw_reporting_cycles where id=s.cycle_id for update;
 if not found or not exists(select 1 from public.tanaw_memberships m where school_id=c.school_id and user_id=auth.uid() and active and 'subjectCoordinator'=any(roles) and s.subject_id=any(subject_ids)) or s.author_id=auth.uid() then raise exception 'Independent assigned subject reviewer required' using errcode='42501'; end if;
 select * into v from public.tanaw_submissions where id=target_submission;
 if c.locked_at is not null and tanaw_private.open_amendment(c.id) is null then raise exception 'Locked cycle' using errcode='42501'; end if;
 if expected_version is null or v.current_version=0 or expected_version<>v.current_version then raise exception 'Current submitted version required' using errcode='40001'; end if;
 insert into public.tanaw_submission_reviews(submission_id,version,stage,reviewer_id,self_review) values(v.id,v.current_version,'subject',auth.uid(),false);
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),'subjectReview',v.id,'Subject review recorded');
end; $$;

create function public.tanaw_prepare_packet(target_cycle uuid,missing_reasons jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.tanaw_reporting_cycles; result uuid; next_version integer; missing_count integer; item jsonb; ids uuid[]='{}'; missing_slot uuid;
begin
 select * into c from public.tanaw_reporting_cycles where id=target_cycle for update;
 if not found or not tanaw_private.has_school_role(c.school_id,array['smeaCoordinator']) then raise exception 'Coordinator required' using errcode='42501'; end if;
 if c.locked_at is not null and tanaw_private.open_amendment(c.id) is null then raise exception 'Locked packet requires an active amendment' using errcode='42501'; end if;
 if jsonb_typeof(missing_reasons) is distinct from 'array' then raise exception 'Missing reasons array required' using errcode='22023'; end if;
 if not exists(select 1 from public.tanaw_submission_slots where cycle_id=c.id) then raise exception 'Assignments required' using errcode='22023'; end if;
 if exists(select 1 from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id where sl.cycle_id=c.id and sub.current_version>0 and not exists(select 1 from public.tanaw_submission_reviews r where r.submission_id=sub.id and r.version=sub.current_version)) then raise exception 'Required subject review missing' using errcode='42501'; end if;
 for item in select value from jsonb_array_elements(missing_reasons) loop
  missing_slot=(item->>'slotId')::uuid;
  if missing_slot is null or missing_slot=any(ids) or nullif(btrim(item->>'reason'),'') is null or not exists(select 1 from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id where sl.id=missing_slot and sl.cycle_id=c.id and sub.current_version=0) then raise exception 'Distinct missing assignment reason required' using errcode='22023'; end if;
  ids=array_append(ids,missing_slot);
 end loop;
 select count(*) into missing_count from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id where sl.cycle_id=c.id and sub.current_version=0;
 if cardinality(ids)<>missing_count then raise exception 'Every missing submission needs a reason' using errcode='22023'; end if;
 select coalesce(max(version),0)+1 into next_version from public.tanaw_school_packets where cycle_id=c.id;
 insert into public.tanaw_school_packets(cycle_id,school_id,version,prepared_by,amendment_round_id,manifest,missing) values(c.id,c.school_id,next_version,auth.uid(),tanaw_private.open_amendment(c.id),tanaw_private.cycle_manifest(c.id),missing_reasons) returning id into result;
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),'preparePacket',result,'Packet prepared for school review');
 return result;
end; $$;

create function public.tanaw_review_packet(target_packet uuid,review_stage text,acknowledge_missing boolean)
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
 insert into public.tanaw_packet_reviews(packet_id,stage,reviewer_id,self_review,acknowledged_missing) values(p.id,review_stage,auth.uid(),p.prepared_by=auth.uid() or own_submission,coalesce(acknowledge_missing,false));
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),review_stage||'Review',p.id,'Packet review recorded');
end; $$;

create function public.tanaw_lock_packet(target_packet uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.tanaw_school_packets; c public.tanaw_reporting_cycles;
begin
 select * into p from public.tanaw_school_packets where id=target_packet;
 select * into c from public.tanaw_reporting_cycles where id=p.cycle_id for update;
 if not found or not tanaw_private.has_school_role(c.school_id,array['smeaCoordinator']) then raise exception 'Coordinator required' using errcode='42501'; end if;
 if p.locked_at is not null or (c.locked_at is not null and (p.amendment_round_id is null or p.amendment_round_id is distinct from tanaw_private.open_amendment(c.id))) then raise exception 'Already locked' using errcode='42501'; end if;
 if p.manifest<>tanaw_private.cycle_manifest(c.id) or p.version<>(select max(version) from public.tanaw_school_packets where cycle_id=c.id) then raise exception 'Stale packet' using errcode='40001'; end if;
 if not exists(select 1 from public.tanaw_packet_reviews where packet_id=p.id and stage='school') or not exists(select 1 from public.tanaw_packet_reviews where packet_id=p.id and stage='head' and not self_review and (jsonb_array_length(p.missing)=0 or acknowledged_missing)) then raise exception 'Current school and independent Head reviews required' using errcode='42501'; end if;
 update public.tanaw_school_packets set locked_at=now(),completeness=case when jsonb_array_length(missing)=0 then 'complete' else 'incomplete' end where id=p.id;
 update public.tanaw_reporting_cycles set locked_at=coalesce(locked_at,now()) where id=c.id;
 if p.amendment_round_id is not null then update public.tanaw_amendment_rounds set closed_at=now() where id=p.amendment_round_id; end if;
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),'lock',p.id,'Explicit school packet Lock');
end; $$;

-- District gets process aggregates only; no manifest, raw evidence or author IDs.
create function public.tanaw_district_packets(target_school uuid) returns table(packet_id uuid,cycle_id uuid,version integer,locked_at timestamptz,completeness text,submission_count integer,missing_count integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not tanaw_private.has_school_role(target_school,array['districtCoordinator']) then raise exception 'Assigned district reviewer required' using errcode='42501'; end if;
 return query select p.id,p.cycle_id,p.version,p.locked_at,p.completeness,jsonb_array_length(p.manifest)-jsonb_array_length(p.missing),jsonb_array_length(p.missing) from public.tanaw_school_packets p where p.school_id=target_school and p.locked_at is not null;
end; $$;
create function public.tanaw_district_review(target_packet uuid,decision text,review_comment text) returns void
language plpgsql security definer set search_path='' as $$
declare p public.tanaw_school_packets;
begin
 select * into p from public.tanaw_school_packets where id=target_packet for update;
 if not found or not tanaw_private.has_school_role(p.school_id,array['districtCoordinator']) then raise exception 'Assigned district reviewer required' using errcode='42501'; end if;
 if p.locked_at is null or decision is null or decision not in ('accept','return') or (decision='return' and nullif(btrim(review_comment),'') is null) then raise exception 'Locked packet and valid decision required' using errcode='22023'; end if;
 insert into public.tanaw_district_decisions(packet_id,reviewer_id,action,comment) values(p.id,auth.uid(),decision,coalesce(review_comment,''));
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(p.school_id,p.cycle_id,auth.uid(),'district'||decision,p.id,coalesce(nullif(btrim(review_comment),''),'District acceptance'));
end; $$;

-- All writes use checked RPCs. Immutable version/review/event tables have no
-- UPDATE/DELETE grants. Raw data policies intentionally exclude district roles.
alter table public.tanaw_submission_slots enable row level security;
alter table public.tanaw_submissions enable row level security;
alter table public.tanaw_submission_versions enable row level security;
alter table public.tanaw_submission_reviews enable row level security;
alter table public.tanaw_school_packets enable row level security;
alter table public.tanaw_packet_reviews enable row level security;
alter table public.tanaw_district_decisions enable row level security;
alter table public.tanaw_workflow_events enable row level security;
revoke all on public.tanaw_submission_slots,public.tanaw_submissions,public.tanaw_submission_versions,public.tanaw_submission_reviews,public.tanaw_school_packets,public.tanaw_packet_reviews,public.tanaw_district_decisions,public.tanaw_workflow_events from anon,authenticated;
grant select on public.tanaw_submission_slots,public.tanaw_submissions,public.tanaw_submission_versions,public.tanaw_submission_reviews,public.tanaw_school_packets,public.tanaw_packet_reviews,public.tanaw_district_decisions,public.tanaw_workflow_events to authenticated;
create policy slot_read on public.tanaw_submission_slots for select to authenticated using(tanaw_private.can_read_slot(id));
create policy submission_read on public.tanaw_submissions for select to authenticated using(tanaw_private.can_read_slot(slot_id));
create policy version_read on public.tanaw_submission_versions for select to authenticated using(exists(select 1 from public.tanaw_submissions s where s.id=submission_id));
create policy subject_review_read on public.tanaw_submission_reviews for select to authenticated using(exists(select 1 from public.tanaw_submissions s where s.id=submission_id));
create policy packet_read on public.tanaw_school_packets for select to authenticated using(tanaw_private.has_school_role(school_id,array['smeaCoordinator','schoolHead']));
create policy packet_review_read on public.tanaw_packet_reviews for select to authenticated using(exists(select 1 from public.tanaw_school_packets p where p.id=packet_id));
create policy district_decision_read on public.tanaw_district_decisions for select to authenticated using(exists(select 1 from public.tanaw_school_packets p where p.id=packet_id) or tanaw_private.has_school_role(tanaw_private.packet_school(packet_id),array['districtCoordinator']));
create policy workflow_event_read on public.tanaw_workflow_events for select to authenticated using(tanaw_private.has_school_role(school_id,array['smeaCoordinator','schoolHead']));

revoke all on function public.tanaw_assign_submission(uuid,uuid,text,text,text),public.tanaw_submit_evidence(uuid,integer,jsonb,text),public.tanaw_extend_submission(uuid,timestamptz,text),public.tanaw_review_submission(uuid,integer),public.tanaw_prepare_packet(uuid,jsonb),public.tanaw_review_packet(uuid,text,boolean),public.tanaw_lock_packet(uuid),public.tanaw_district_packets(uuid),public.tanaw_district_review(uuid,text,text) from public,anon,authenticated;
grant execute on function public.tanaw_assign_submission(uuid,uuid,text,text,text),public.tanaw_submit_evidence(uuid,integer,jsonb,text),public.tanaw_extend_submission(uuid,timestamptz,text),public.tanaw_review_submission(uuid,integer),public.tanaw_prepare_packet(uuid,jsonb),public.tanaw_review_packet(uuid,text,boolean),public.tanaw_lock_packet(uuid),public.tanaw_district_packets(uuid),public.tanaw_district_review(uuid,text,text) to authenticated;

alter table public.tanaw_amendment_rounds enable row level security;
revoke all on public.tanaw_amendment_rounds from anon,authenticated;
grant select on public.tanaw_amendment_rounds to authenticated;
create policy amendment_read on public.tanaw_amendment_rounds for select to authenticated using(tanaw_private.has_school_role((select school_id from public.tanaw_reporting_cycles c where c.id=cycle_id),array['smeaCoordinator','schoolHead','teacher','subjectCoordinator']));
revoke all on function public.tanaw_open_amendment(uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.tanaw_open_amendment(uuid,timestamptz,text) to authenticated;
grant select on public.smea_indicator_definitions to authenticated;
create policy definition_school_read on public.smea_indicator_definitions for select to authenticated using(tanaw_private.has_school_role(school_id,array['teacher','subjectCoordinator','smeaCoordinator','schoolHead']));
