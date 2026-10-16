-- Server-only ownership for provisioning. No worker, Auth credential or rollout.
alter table public.tanaw_provisioning_requests add column worker_epoch bigint not null default 0 check(worker_epoch>=0);
create table public.tanaw_provisioning_worker_claims (
 request_id uuid primary key references public.tanaw_provisioning_requests(id) on delete restrict,
 epoch bigint not null check(epoch>0), token uuid not null, expires_at timestamptz not null check(isfinite(expires_at))
);
alter table public.tanaw_provisioning_worker_claims enable row level security;
revoke all on public.tanaw_provisioning_worker_claims from public,anon,authenticated,service_role;
grant select on public.tanaw_provisioning_worker_claims to service_role;

-- Shared lock order: actor advisory + actor membership row, request, worker claim,
-- target advisory + target membership. Caller identity cannot come from payload.
create function tanaw_private.lock_account_request(target uuid, expected_actor uuid)
returns public.tanaw_provisioning_requests language plpgsql set search_path='' as $$
declare r public.tanaw_provisioning_requests;
begin
 select * into r from public.tanaw_provisioning_requests where id=target;
 if not found or (expected_actor is not null and r.actor_id<>expected_actor) then
  raise exception 'Request unavailable' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.school_id::text||':'||r.actor_id::text,0));
 perform 1 from public.tanaw_memberships m where m.school_id=r.school_id and m.user_id=r.actor_id
  and m.active and 'smeaCoordinator'=any(m.roles) for update;
 if not found then raise exception 'Active school coordinator required' using errcode='42501'; end if;
 select * into strict r from public.tanaw_provisioning_requests where id=target for update;
 return r;
end $$;
revoke all on function tanaw_private.lock_account_request(uuid,uuid) from public,anon,authenticated,service_role;

create function public.tanaw_claim_account_work(request_id uuid, lease_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.tanaw_provisioning_requests; c public.tanaw_provisioning_worker_claims;
begin
 if lease_seconds is null or lease_seconds not between 1 and 300 then
  raise exception 'Bounded worker duration required' using errcode='22023'; end if;
 r:=tanaw_private.lock_account_request(request_id,null);
 if r.completed_at is not null then return jsonb_build_object('status','complete','userId',r.completed_user_id); end if;
 select * into c from public.tanaw_provisioning_worker_claims w where w.request_id=r.id for update;
 if found and c.expires_at>clock_timestamp() then return jsonb_build_object('status','busy'); end if;
 update public.tanaw_provisioning_requests set worker_epoch=worker_epoch+1 where id=r.id returning * into r;
 insert into public.tanaw_provisioning_worker_claims(request_id,epoch,token,expires_at)
  values(r.id,r.worker_epoch,gen_random_uuid(),clock_timestamp()+make_interval(secs=>lease_seconds))
  on conflict on constraint tanaw_provisioning_worker_claims_pkey do update
   set epoch=excluded.epoch,token=excluded.token,expires_at=excluded.expires_at returning * into c;
 return jsonb_build_object('status','claimed','epoch',c.epoch,'token',c.token,'expiresAt',c.expires_at);
end $$;
revoke all on function public.tanaw_claim_account_work(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.tanaw_claim_account_work(uuid,integer) to service_role;

create function tanaw_private.complete_locked_account(r public.tanaw_provisioning_requests, worker_epoch bigint, worker_token uuid)
returns uuid language plpgsql set search_path='' as $$
declare c public.tanaw_provisioning_worker_claims; resulting jsonb;
begin
 if worker_epoch is not null then
  select * into c from public.tanaw_provisioning_worker_claims w where w.request_id=r.id for update;
  if not found or c.epoch is distinct from worker_epoch or r.worker_epoch is distinct from worker_epoch
   or c.token is distinct from worker_token or c.expires_at<=clock_timestamp() then
   raise exception 'Worker ownership unavailable' using errcode='42501'; end if;
 elsif r.completed_at is null and r.worker_epoch>0 then
  raise exception 'Claimed request requires server completion' using errcode='42501';
 end if;
 -- Historical receipts never reactivate a later disabled/changed membership.
 if r.completed_at is not null then return r.completed_user_id; end if;
 if r.reserved_user_id=r.actor_id then raise exception 'Self assignment denied' using errcode='42501'; end if;
 if not exists(select 1 from auth.users u where u.id=r.reserved_user_id and lower(u.email)=r.email
  and u.raw_app_meta_data->>'tanaw_provision_request_id'=r.id::text
  and u.raw_app_meta_data->>'tanaw_provision_school_id'=r.school_id::text) then
  raise exception 'Reserved Auth identity not verified' using errcode='22023'; end if;
 -- Same revision-zero semantics as manage_member, with the stored actor rather
 -- than spoofing auth.uid() in a service-role request. Reserved fields are fixed.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.school_id::text||':'||r.reserved_user_id::text,0));
 perform 1 from public.tanaw_memberships where school_id=r.school_id and user_id=r.reserved_user_id for update;
 if found then raise exception 'Membership changed; review required' using errcode='40001'; end if;
 -- Recheck elapsed ownership after potentially waiting on the target lock.
 if worker_epoch is not null and c.expires_at<=clock_timestamp() then
  raise exception 'Worker ownership expired' using errcode='42501'; end if;
 insert into public.tanaw_memberships(school_id,user_id,roles,subject_ids,active,revision)
  values(r.school_id,r.reserved_user_id,r.roles,r.subject_ids,true,1) returning to_jsonb(tanaw_memberships.*) into resulting;
 insert into public.tanaw_membership_events(school_id,target_user_id,actor_id,reason,before_value,after_value)
  values(r.school_id,r.reserved_user_id,r.actor_id,r.reason,null,resulting);
 update public.tanaw_provisioning_requests set completed_at=now(),completed_user_id=r.reserved_user_id where id=r.id;
 return r.reserved_user_id;
end $$;
revoke all on function tanaw_private.complete_locked_account(public.tanaw_provisioning_requests,bigint,uuid) from public,anon,authenticated,service_role;

create or replace function public.tanaw_complete_account(request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.tanaw_provisioning_requests;
begin
 if auth.uid() is null then raise exception 'Authenticated coordinator required' using errcode='42501'; end if;
 r:=tanaw_private.lock_account_request(request_id,auth.uid());
 return tanaw_private.complete_locked_account(r,null,null);
end $$;

create function public.tanaw_finish_account_work(request_id uuid, epoch bigint, token uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.tanaw_provisioning_requests;
begin
 if epoch is null or token is null then raise exception 'Worker ownership required' using errcode='42501'; end if;
 r:=tanaw_private.lock_account_request(request_id,null);
 return tanaw_private.complete_locked_account(r,epoch,token);
end $$;
revoke all on function public.tanaw_finish_account_work(uuid,bigint,uuid) from public,anon,authenticated,service_role;
grant execute on function public.tanaw_finish_account_work(uuid,bigint,uuid) to service_role;

create function public.tanaw_account_work_owned(request_id uuid, epoch bigint, token uuid)
returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from public.tanaw_provisioning_worker_claims w
  join public.tanaw_provisioning_requests r on r.id=w.request_id
  join public.tanaw_memberships m on m.school_id=r.school_id and m.user_id=r.actor_id
  where w.request_id=$1
   and w.epoch=$2 and r.worker_epoch=w.epoch
   and w.token=$3 and w.expires_at>clock_timestamp()
   and r.completed_at is null and m.active and 'smeaCoordinator'=any(m.roles));
$$;
revoke all on function public.tanaw_account_work_owned(uuid,bigint,uuid) from public,anon,authenticated,service_role;
grant execute on function public.tanaw_account_work_owned(uuid,bigint,uuid) to service_role;
