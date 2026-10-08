-- Local-only coordinator-managed membership foundation.
-- No real school, user, account, deadline or official record is seeded.
create schema if not exists tanaw_private;
revoke all on schema tanaw_private from public, anon;
grant usage on schema tanaw_private to authenticated;

create table public.tanaw_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (nullif(btrim(name), '') is not null),
  created_at timestamptz not null default now()
);
create table public.tanaw_memberships (
  school_id uuid not null references public.tanaw_schools(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  roles text[] not null check (
    cardinality(roles) > 0 and array_position(roles, null) is null
    and roles <@ array['teacher','subjectCoordinator','smeaCoordinator','schoolHead','districtCoordinator']::text[]
  ),
  subject_ids text[] not null default '{}' check (array_position(subject_ids, null) is null),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (school_id, user_id)
);
create table public.tanaw_membership_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.tanaw_schools(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (nullif(btrim(reason), '') is not null),
  before_value jsonb,
  after_value jsonb not null,
  occurred_at timestamptz not null default now()
);

alter table public.tanaw_schools enable row level security;
alter table public.tanaw_memberships enable row level security;
alter table public.tanaw_membership_events enable row level security;
revoke all on public.tanaw_schools, public.tanaw_memberships, public.tanaw_membership_events from anon, authenticated;
grant select on public.tanaw_schools, public.tanaw_memberships, public.tanaw_membership_events to authenticated;

-- Security definer avoids recursive membership RLS; identity is always auth.uid().
-- This helper is not exposed in the public PostgREST schema.
create function tanaw_private.has_school_role(target_school uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tanaw_memberships m
    where m.school_id = target_school and m.user_id = auth.uid()
      and m.active and (allowed_roles is null or m.roles && allowed_roles)
  );
$$;
revoke all on function tanaw_private.has_school_role(uuid,text[]) from public, anon, authenticated;
grant execute on function tanaw_private.has_school_role(uuid,text[]) to authenticated;

create policy tanaw_school_member_read on public.tanaw_schools
  for select to authenticated
  using (tanaw_private.has_school_role(id, null));
create policy tanaw_membership_read on public.tanaw_memberships
  for select to authenticated
  using (
    tanaw_private.has_school_role(school_id, null)
    and (user_id = auth.uid() or tanaw_private.has_school_role(school_id, array['smeaCoordinator']))
  );
create policy tanaw_membership_event_read on public.tanaw_membership_events
  for select to authenticated
  using (tanaw_private.has_school_role(school_id, array['smeaCoordinator']));

-- No direct client write grants. All changes are attributable, reasoned and atomic.
-- Initial coordinator provisioning is an explicit trusted operational step;
-- signing up does not create membership or grant privileges.
create function public.tanaw_manage_member(
  target_school uuid, target_user uuid, new_roles text[],
  new_subject_ids text[], is_active boolean, change_reason text
) returns void language plpgsql security definer set search_path = ''
as $$
declare previous jsonb; resulting jsonb;
begin
  if not tanaw_private.has_school_role(target_school, array['smeaCoordinator']) then
    raise exception 'Coordinator membership required' using errcode = '42501';
  end if;
  if target_user = auth.uid() then
    raise exception 'Self-assignment is not allowed' using errcode = '42501';
  end if;
  if target_user is null or new_roles is null or cardinality(new_roles) = 0
      or array_position(new_roles, null) is not null
      or not (new_roles <@ array['teacher','subjectCoordinator','smeaCoordinator','schoolHead','districtCoordinator']::text[])
      or new_subject_ids is null or array_position(new_subject_ids, null) is not null
      or exists(select 1 from unnest(new_subject_ids) s where nullif(btrim(s), '') is null)
      or is_active is null or nullif(btrim(change_reason), '') is null then
    raise exception 'Invalid membership change' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_school::text || ':' || target_user::text, 0));
  select to_jsonb(m) into previous from public.tanaw_memberships m
    where m.school_id = target_school and m.user_id = target_user for update;
  insert into public.tanaw_memberships (school_id, user_id, roles, subject_ids, active)
    values (target_school, target_user, new_roles, new_subject_ids, is_active)
    on conflict (school_id, user_id) do update
      set roles = excluded.roles, subject_ids = excluded.subject_ids,
          active = excluded.active, updated_at = now();
  select to_jsonb(m) into resulting from public.tanaw_memberships m
    where m.school_id = target_school and m.user_id = target_user;
  insert into public.tanaw_membership_events
    (school_id, target_user_id, actor_id, reason, before_value, after_value)
    values (target_school, target_user, auth.uid(), change_reason, previous, resulting);
end;
$$;
revoke all on function public.tanaw_manage_member(uuid,uuid,text[],text[],boolean,text) from public, anon, authenticated;
grant execute on function public.tanaw_manage_member(uuid,uuid,text[],text[],boolean,text) to authenticated;
-- Raw indicator evidence remains without client grants pending per-submission
-- ownership/subject lineage and reviewed aggregate-only district projections.
