-- The anonymous probe exposes only whether the expected runtime contract exists.
create function public.tanaw_release_ready() returns boolean
language sql stable security invoker set search_path='' as $$
 select to_regclass('public.tanaw_submission_versions') is not null
    and to_regclass('public.tanaw_school_packets') is not null
    and to_regclass('public.tanaw_district_decisions') is not null
    and to_regprocedure('public.tanaw_workflow_snapshot(uuid,boolean)') is not null
    and to_regprocedure('public.tanaw_packet_evidence_snapshot(uuid)') is not null
    and to_regprocedure('public.tanaw_district_packet_page(uuid,timestamp with time zone,uuid)') is not null
    and to_regprocedure('public.tanaw_district_decision_page(uuid,bigint)') is not null;
$$;
revoke all on function public.tanaw_release_ready() from public,anon,authenticated;
grant execute on function public.tanaw_release_ready() to anon;
