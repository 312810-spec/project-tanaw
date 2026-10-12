-- Only current evidence and the latest exact packet snapshot, under existing RLS.
-- No official data, dates, formula changes or authorization widening is seeded.
create function public.tanaw_workflow_evidence(target_cycle uuid)
returns table(submission_id uuid, version integer, evidence jsonb, reason text, created_at timestamptz)
language sql stable security invoker set search_path='' as $$
 with latest as (
  select p.manifest from public.tanaw_school_packets p
  where p.cycle_id=target_cycle order by p.version desc limit 1
 )
 select v.submission_id,v.version,v.evidence,v.reason,v.created_at
 from public.tanaw_submission_versions v
 join public.tanaw_submissions sub on sub.id=v.submission_id
 join public.tanaw_submission_slots sl on sl.id=sub.slot_id
 where sl.cycle_id=target_cycle and (v.version=sub.current_version or exists(
  select 1 from latest,jsonb_array_elements(latest.manifest) item
  where item->>'submission'=v.submission_id::text and (item->>'version')::integer=v.version
 )) order by v.submission_id,v.version;
$$;
revoke all on function public.tanaw_workflow_evidence(uuid) from public,anon,authenticated;
grant execute on function public.tanaw_workflow_evidence(uuid) to authenticated;

-- Staff labels are confined to the requesting school's authorized work scope.
create function public.tanaw_workflow_people(target_school uuid)
returns table(user_id uuid,label text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not tanaw_private.has_school_role(target_school,array['teacher','subjectCoordinator','smeaCoordinator','schoolHead']) then
  raise exception 'Assigned school role required' using errcode='42501';
 end if;
 return query select m.user_id,coalesce(nullif(u.email,''),m.user_id::text)
 from public.tanaw_memberships m join auth.users u on u.id=m.user_id
 where m.school_id=target_school and (m.user_id=auth.uid()
  or tanaw_private.has_school_role(target_school,array['smeaCoordinator','schoolHead'])
  or exists(select 1 from public.tanaw_submission_slots s
    where s.school_id=target_school and s.author_id=m.user_id and tanaw_private.can_read_slot(s.id)))
 order by m.user_id;
end; $$;
revoke all on function public.tanaw_workflow_people(uuid) from public,anon,authenticated;
grant execute on function public.tanaw_workflow_people(uuid) to authenticated;

-- Freeze displayed definition semantics in NEW packets. Existing locked rows stay untouched.
create or replace function tanaw_private.cycle_manifest(target_cycle uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'slot',s.id,'submission',v.id,'version',v.current_version,
  'requiredIndicators',s.required_indicator_ids,'requirementsRevision',s.requirements_revision,
  'coverageComplete',tanaw_private.slot_complete(s.id),
  'definitions',coalesce((select jsonb_agg(jsonb_build_object(
    'id',d.id,'label',d.label,'unit',d.unit,'sourceTitle',d.source_title,
    'sourceLocator',d.source_locator,'sourceId',d.source_id,'schoolYear',d.school_year,'period',d.reporting_period,
    'formula',d.formula_expression,'numerator',d.numerator_definition,'denominator',d.denominator_definition,'rounding',d.rounding_rule) order by d.id)
   from public.smea_indicator_definitions d where d.school_id=s.school_id
   and (d.id=any(s.required_indicator_ids) or exists(
    select 1 from public.tanaw_submission_versions sv,jsonb_array_elements(sv.evidence->'entries') e
    where sv.submission_id=v.id and sv.version=v.current_version and e->>'definitionId'=d.id::text))), '[]'::jsonb)
 ) order by s.id),'[]'::jsonb)
 from public.tanaw_submission_slots s left join public.tanaw_submissions v on v.slot_id=s.id
 where s.cycle_id=target_cycle;
$$;
