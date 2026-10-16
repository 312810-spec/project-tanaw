-- Durable reservations only. No Auth admin credentials, endpoint or bootstrap.
create table public.tanaw_provisioning_requests (
 id uuid primary key,
 school_id uuid not null references public.tanaw_schools(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 reserved_user_id uuid not null unique default gen_random_uuid(),
 email text not null check(char_length(email) between 3 and 254 and email=lower(btrim(email))),
 roles text[] not null, subject_ids text[] not null, reason text not null,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 completed_user_id uuid references auth.users(id) on delete restrict,
 unique(school_id,email),
 check((completed_at is null and completed_user_id is null) or
       (completed_at is not null and completed_user_id is not null and completed_user_id=reserved_user_id))
);
alter table public.tanaw_provisioning_requests enable row level security;
revoke all on public.tanaw_provisioning_requests from public,anon,authenticated,service_role;
grant select on public.tanaw_provisioning_requests to authenticated,service_role;
create policy provisioning_request_read on public.tanaw_provisioning_requests
 for select to authenticated using(actor_id=auth.uid() and
 tanaw_private.has_school_role(school_id,array['smeaCoordinator']));

create function public.tanaw_reserve_account(
 target_school uuid, request_id uuid, account_email text, assigned_roles text[],
 assigned_subjects text[], change_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); normalized_email text:=lower(btrim(account_email));
 r public.tanaw_provisioning_requests; sorted_roles text[]; sorted_subjects text[];
begin
 -- Same membership key as tanaw_manage_member; hold the actor row through commit.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_school::text||':'||actor::text,0));
 perform 1 from public.tanaw_memberships m where m.school_id=target_school and m.user_id=actor
  and m.active and 'smeaCoordinator'=any(m.roles) for update;
 if not found then raise exception 'Active school coordinator required' using errcode='42501'; end if;
 if request_id is null or normalized_email is null or char_length(normalized_email)>254
  or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  or normalized_email ~ '[[:cntrl:]]'
  or assigned_roles is null or cardinality(assigned_roles) not between 1 and 5
  or array_position(assigned_roles,null) is not null
  or not (assigned_roles <@ array['teacher','subjectCoordinator','smeaCoordinator','schoolHead','districtCoordinator']::text[])
  or assigned_subjects is null or cardinality(assigned_subjects)>100
  or array_position(assigned_subjects,null) is not null
  or exists(select 1 from unnest(assigned_subjects) s where char_length(s) not between 1 and 200 or s<>btrim(s) or s ~ '[[:cntrl:]]')
  or nullif(btrim(change_reason),'') is null or char_length(change_reason)>2000 or change_reason ~ '[[:cntrl:]]'
 then raise exception 'Invalid account reservation' using errcode='22023'; end if;
 select array_agg(distinct v order by v) into sorted_roles from unnest(assigned_roles) v;
 select coalesce(array_agg(distinct v order by v),'{}'::text[]) into sorted_subjects from unnest(assigned_subjects) v;
 select * into r from public.tanaw_provisioning_requests p where p.id=request_id for update;
 if found then
  if r.actor_id<>actor or r.school_id<>target_school then
   raise exception 'Request unavailable' using errcode='42501'; end if;
  if r.email<>normalized_email or r.roles<>sorted_roles or r.subject_ids<>sorted_subjects or r.reason<>btrim(change_reason) then
   raise exception 'Request payload changed' using errcode='22023'; end if;
  return r.reserved_user_id;
 end if;
 -- A competing coordinator/email reservation receives no existing identity details.
 begin
  insert into public.tanaw_provisioning_requests(id,school_id,actor_id,email,roles,subject_ids,reason)
   values(request_id,target_school,actor,normalized_email,sorted_roles,sorted_subjects,btrim(change_reason))
   returning * into r;
 exception when unique_violation then
  raise exception 'Account reservation conflicts; review required' using errcode='40001';
 end;
 return r.reserved_user_id;
end $$;
revoke all on function public.tanaw_reserve_account(uuid,uuid,text,text[],text[],text) from public,anon,authenticated,service_role;
grant execute on function public.tanaw_reserve_account(uuid,uuid,text,text[],text[],text) to authenticated;

create function public.tanaw_complete_account(request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); r public.tanaw_provisioning_requests;
begin
 -- Read private actor/school only to choose locks, then recheck the row under lock.
 select * into r from public.tanaw_provisioning_requests p where p.id=request_id and p.actor_id=actor;
 if not found then raise exception 'Request unavailable' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.school_id::text||':'||actor::text,0));
 perform 1 from public.tanaw_memberships m where m.school_id=r.school_id and m.user_id=actor
  and m.active and 'smeaCoordinator'=any(m.roles) for update;
 if not found then raise exception 'Active school coordinator required' using errcode='42501'; end if;
 select * into r from public.tanaw_provisioning_requests p where p.id=request_id and p.actor_id=actor for update;
 if r.completed_at is not null then return r.completed_user_id; end if;
 -- Only a trusted Auth admin can set raw_app_meta_data. Never adopt by email alone.
 if not exists(select 1 from auth.users u where u.id=r.reserved_user_id and lower(u.email)=r.email
  and u.raw_app_meta_data->>'tanaw_provision_request_id'=r.id::text
  and u.raw_app_meta_data->>'tanaw_provision_school_id'=r.school_id::text) then
  raise exception 'Reserved Auth identity not verified' using errcode='22023'; end if;
 perform public.tanaw_manage_member(r.school_id,r.reserved_user_id,r.roles,r.subject_ids,true,r.reason,0);
 update public.tanaw_provisioning_requests set completed_at=now(),completed_user_id=r.reserved_user_id where id=r.id;
 return r.reserved_user_id;
end $$;
revoke all on function public.tanaw_complete_account(uuid) from public,anon,authenticated,service_role;
grant execute on function public.tanaw_complete_account(uuid) to authenticated;
