-- Keep the existing district packet authorization and decision RLS.
-- Return the latest decision independently of the history page size.
create index tanaw_district_decisions_packet_revision_idx
 on public.tanaw_district_decisions(packet_id,decision_revision desc);

create function public.tanaw_district_packet_page(
 target_school uuid, before_lock timestamptz default null, before_packet uuid default null
) returns table(
 packet_id uuid,cycle_id uuid,version integer,locked_at timestamptz,completeness text,
 submission_count integer,missing_count integer,period_label text,latest_decision jsonb
)
language sql stable security invoker set search_path='' as $$
 with page as (
  select p.* from public.tanaw_district_packets(target_school) p
  where (before_lock is null and before_packet is null)
     or (p.locked_at,p.packet_id)<(before_lock,before_packet)
  order by p.locked_at desc,p.packet_id desc limit 26
 )
 select p.packet_id,p.cycle_id,p.version,p.locked_at,p.completeness,p.submission_count,p.missing_count,
  b.school_year||' · '||b.label,
  to_jsonb(d)
 from page p
 left join public.tanaw_reporting_cycles c on c.id=p.cycle_id
 left join public.tanaw_instructional_blocks b on b.id=c.instructional_block_id
 left join lateral (
  select id,action,comment,created_at,decision_revision::text as revision
  from public.tanaw_district_decisions
  where packet_id=p.packet_id order by decision_revision desc limit 1
 ) d on true
 order by p.locked_at desc,p.packet_id desc;
$$;
revoke all on function public.tanaw_district_packet_page(uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.tanaw_district_packet_page(uuid,timestamptz,uuid) to authenticated;

create function public.tanaw_district_decision_page(target_packet uuid, before_revision bigint)
returns table(id uuid,action text,comment text,created_at timestamptz,revision text)
language sql stable security invoker set search_path='' as $$
 select d.id,d.action,d.comment,d.created_at,d.decision_revision::text
 from public.tanaw_district_decisions d
 where d.packet_id=target_packet and d.decision_revision<before_revision
 order by d.decision_revision desc limit 21;
$$;
revoke all on function public.tanaw_district_decision_page(uuid,bigint) from public,anon,authenticated;
grant execute on function public.tanaw_district_decision_page(uuid,bigint) to authenticated;
