-- Read the workflow's mutable collections in one statement under existing RLS.
-- Fetch one extra row to detect a response that would exceed the read limit.
create function public.tanaw_workflow_snapshot(target_cycle uuid, own_slots_only boolean)
returns jsonb
language sql stable security invoker set search_path='' as $$
 with slots as (
  select id,author_id,subject_id,scope_label,required_indicator_ids,requirements_revision
  from public.tanaw_submission_slots
  where cycle_id=target_cycle and (not own_slots_only or author_id=auth.uid())
  order by id limit 5001
 ), submissions as (
  select s.id,s.slot_id,s.current_version,s.extension_until,s.extension_reason
  from public.tanaw_submissions s join slots sl on sl.id=s.slot_id
  order by s.id limit 5001
 ), reviews as (
  select r.submission_id,r.version,r.reviewer_id,r.self_review
  from public.tanaw_submission_reviews r join submissions s on s.id=r.submission_id
  order by r.submission_id,r.version limit 5001
 ), evidence as (
  select e.*
  from public.tanaw_workflow_evidence(target_cycle) e join submissions s on s.id=e.submission_id
  order by e.submission_id,e.version limit 5001
 )
 select case when (select count(*) from slots)>5000
                   or (select count(*) from submissions)>5000
                   or (select count(*) from reviews)>5000
                   or (select count(*) from evidence)>5000
  then null
  else jsonb_build_object(
   'slots',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from slots s),'[]'::jsonb),
   'submissions',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from submissions s),'[]'::jsonb),
   'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.submission_id,r.version) from reviews r),'[]'::jsonb),
   'evidence',coalesce((select jsonb_agg(to_jsonb(e) order by e.submission_id,e.version) from evidence e),'[]'::jsonb),
   'packets',coalesce((
    select jsonb_agg(to_jsonb(p) order by p.version desc)
    from (
     select id,version,locked_at,completeness,missing,manifest,prepared_by,amendment_round_id
     from public.tanaw_school_packets where cycle_id=target_cycle order by version desc limit 20
    ) p
   ),'[]'::jsonb)
  ) end;
$$;
revoke all on function public.tanaw_workflow_snapshot(uuid,boolean) from public,anon,authenticated;
grant execute on function public.tanaw_workflow_snapshot(uuid,boolean) to authenticated;

create function public.tanaw_packet_evidence_snapshot(target_packet uuid)
returns jsonb
language sql stable security invoker set search_path='' as $$
 select case when count(*)>5000 then null
  else coalesce(jsonb_agg(to_jsonb(e) order by e.submission_id,e.version),'[]'::jsonb) end
 from (
  select * from public.tanaw_packet_evidence(target_packet)
  order by submission_id,version limit 5001
 ) e;
$$;
revoke all on function public.tanaw_packet_evidence_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.tanaw_packet_evidence_snapshot(uuid) to authenticated;
