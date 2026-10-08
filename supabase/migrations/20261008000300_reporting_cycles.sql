-- Local-only foundation. Calendar entries require trusted, verified source provisioning.
-- No school-year dates or production data are seeded.
create table public.tanaw_instructional_blocks (
  id uuid primary key default gen_random_uuid(),
  school_year text not null check (nullif(btrim(school_year), '') is not null),
  label text not null check (nullif(btrim(label), '') is not null),
  end_date date not null,
  source_order text not null check (nullif(btrim(source_order), '') is not null),
  source_url text not null check (source_url ~ '^https://'),
  verified_at timestamptz not null,
  unique (school_year, label, source_order)
);
create table public.tanaw_reporting_cycles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.tanaw_schools(id) on delete restrict,
  instructional_block_id uuid not null references public.tanaw_instructional_blocks(id) on delete restrict,
  deadline_at timestamptz not null check (isfinite(deadline_at)),
  revision integer not null default 1 check (revision > 0),
  locked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, instructional_block_id)
);
create table public.tanaw_cycle_events (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.tanaw_reporting_cycles(id) on delete restrict,
  school_id uuid not null references public.tanaw_schools(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (nullif(btrim(reason), '') is not null),
  before_value jsonb,
  after_value jsonb not null,
  occurred_at timestamptz not null default now()
);
alter table public.tanaw_instructional_blocks enable row level security;
alter table public.tanaw_reporting_cycles enable row level security;
alter table public.tanaw_cycle_events enable row level security;
revoke all on public.tanaw_instructional_blocks, public.tanaw_reporting_cycles, public.tanaw_cycle_events from anon, authenticated;
grant select on public.tanaw_instructional_blocks, public.tanaw_reporting_cycles, public.tanaw_cycle_events to authenticated;
create policy tanaw_calendar_read on public.tanaw_instructional_blocks for select to authenticated
  using (exists (select 1 from public.tanaw_memberships m where m.user_id = auth.uid() and m.active));
create policy tanaw_cycle_read on public.tanaw_reporting_cycles for select to authenticated
  using (tanaw_private.has_school_role(school_id, null));
create policy tanaw_cycle_event_read on public.tanaw_cycle_events for select to authenticated
  using (tanaw_private.has_school_role(school_id, array['smeaCoordinator','schoolHead']));

-- Coordinator chooses a future deadline for a verified block.
-- Instructional end dates cannot be edited or inferred from deadline values.
create function public.tanaw_set_cycle_deadline(
  target_school uuid, target_block uuid, new_deadline timestamptz,
  expected_revision integer, change_reason text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare previous jsonb; resulting jsonb; target_cycle uuid; current_revision integer; lock_time timestamptz;
begin
  if not tanaw_private.has_school_role(target_school, array['smeaCoordinator']) then
    raise exception 'Coordinator membership required' using errcode = '42501';
  end if;
  if new_deadline is null or not isfinite(new_deadline) or new_deadline <= now()
      or expected_revision is null or expected_revision < 0
      or nullif(btrim(change_reason), '') is null then
    raise exception 'Invalid deadline change' using errcode = '22023';
  end if;
  if not exists(select 1 from public.tanaw_instructional_blocks where id = target_block) then
    raise exception 'Verified instructional block required' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_school::text || ':' || target_block::text, 1));
  select id, revision, locked_at, to_jsonb(c) into target_cycle, current_revision, lock_time, previous
    from public.tanaw_reporting_cycles c
    where school_id = target_school and instructional_block_id = target_block for update;
  if target_cycle is null then
    if expected_revision <> 0 then raise exception 'Cycle revision conflict' using errcode = '40001'; end if;
    insert into public.tanaw_reporting_cycles(school_id,instructional_block_id,deadline_at,created_by)
      values(target_school,target_block,new_deadline,auth.uid()) returning id into target_cycle;
  else
    if lock_time is not null then raise exception 'Locked cycle cannot change deadline' using errcode = '42501'; end if;
    if expected_revision <> current_revision then raise exception 'Cycle revision conflict' using errcode = '40001'; end if;
    -- Once the deadline closes, reopening must use per-submission extensions.
    if (previous->>'deadline_at')::timestamptz <= now() then
      raise exception 'Closed deadline requires submission extension' using errcode = '42501';
    end if;
    update public.tanaw_reporting_cycles set deadline_at = new_deadline,
      revision = revision + 1, updated_at = now() where id = target_cycle;
  end if;
  select to_jsonb(c) into resulting from public.tanaw_reporting_cycles c where id = target_cycle;
  insert into public.tanaw_cycle_events(cycle_id,school_id,actor_id,reason,before_value,after_value)
    values(target_cycle,target_school,auth.uid(),change_reason,previous,resulting);
  return target_cycle;
end;
$$;
revoke all on function public.tanaw_set_cycle_deadline(uuid,uuid,timestamptz,integer,text) from public,anon,authenticated;
grant execute on function public.tanaw_set_cycle_deadline(uuid,uuid,timestamptz,integer,text) to authenticated;
-- Locking is deliberately not exposed until packet review persistence is implemented.
