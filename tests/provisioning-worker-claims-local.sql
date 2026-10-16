-- Synthetic server-only worker ownership. All rows roll back.
begin;
insert into auth.users(id,email) values('81000000-0000-4000-8000-000000000001','claim-co@fixture.invalid');
insert into public.tanaw_schools(id,name) values('82000000-0000-4000-8000-000000000001','Synthetic claim school');
insert into public.tanaw_memberships(school_id,user_id,roles,subject_ids) values
 ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001',array['smeaCoordinator'],'{}');
create temp table claim_fixture(label text primary key,payload jsonb,id uuid);
grant all on claim_fixture to authenticated,service_role;
create function pg_temp.claim_deny(stmt text,code text) returns void language plpgsql as $$
begin
 begin execute stmt;
 exception when others then if sqlstate=code then return; else raise; end if; end;
 raise exception 'Expected claim denial %',code;
end $$;
do $$ begin
 if not (select relrowsecurity from pg_class where oid='public.tanaw_provisioning_worker_claims'::regclass)
  or has_table_privilege('authenticated','public.tanaw_provisioning_worker_claims','SELECT,INSERT,UPDATE,DELETE')
  or has_table_privilege('service_role','public.tanaw_provisioning_worker_claims','INSERT,UPDATE,DELETE')
  or has_function_privilege('authenticated','public.tanaw_claim_account_work(uuid,integer)','EXECUTE')
  or has_function_privilege('anon','public.tanaw_finish_account_work(uuid,bigint,uuid)','EXECUTE')
  or has_function_privilege('authenticated','tanaw_private.complete_locked_account(public.tanaw_provisioning_requests,bigint,uuid)','EXECUTE') then
  raise exception 'Worker claim ACL/RLS failed'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-4000-8000-000000000001',true);
insert into claim_fixture(label,id) select 'target',public.tanaw_reserve_account('82000000-0000-4000-8000-000000000001',
 '83000000-0000-4000-8000-000000000001','claimed@fixture.invalid',array['teacher'],array['math'],'Synthetic claim request');
select pg_temp.claim_deny($q$select public.tanaw_claim_account_work('83000000-0000-4000-8000-000000000001',60)$q$,'42501');
reset role;
set local role service_role;
insert into claim_fixture(label,payload) select 'first',public.tanaw_claim_account_work('83000000-0000-4000-8000-000000000001',60);
do $$ declare c jsonb:=(select payload from claim_fixture where label='first'); begin
 if c->>'status'<>'claimed' or (c->>'epoch')::bigint<>1 then raise exception 'Initial claim failed'; end if;
 if public.tanaw_claim_account_work('83000000-0000-4000-8000-000000000001',60)<>jsonb_build_object('status','busy') then
  raise exception 'Active claim was stolen'; end if;
 if not public.tanaw_account_work_owned('83000000-0000-4000-8000-000000000001',1,(c->>'token')::uuid) then
  raise exception 'Current ownership not recognized'; end if;
 perform pg_temp.claim_deny($q$select public.tanaw_claim_account_work('83000000-0000-4000-8000-000000000001',301)$q$,'22023');
 perform pg_temp.claim_deny(format('select public.tanaw_finish_account_work(%L,1,%L)','83000000-0000-4000-8000-000000000001',c->>'token'),'22023');
end $$;
reset role;
set local role authenticated;
select pg_temp.claim_deny($q$select public.tanaw_complete_account('83000000-0000-4000-8000-000000000001')$q$,'42501');
reset role;
-- Fast-forward only this synthetic lease to test successor behavior without sleep.
update public.tanaw_provisioning_worker_claims set expires_at=clock_timestamp()-interval '1 second'
 where request_id='83000000-0000-4000-8000-000000000001';
set local role service_role;
do $$ declare c jsonb:=(select payload from claim_fixture where label='first'); begin
 if public.tanaw_account_work_owned('83000000-0000-4000-8000-000000000001',1,(c->>'token')::uuid) then
  raise exception 'Expired ownership accepted'; end if;
 perform pg_temp.claim_deny(format('select public.tanaw_finish_account_work(%L,1,%L)','83000000-0000-4000-8000-000000000001',c->>'token'),'42501');
end $$;
insert into claim_fixture(label,payload) select 'second',public.tanaw_claim_account_work('83000000-0000-4000-8000-000000000001',60);
do $$ declare old jsonb:=(select payload from claim_fixture where label='first');
 fresh jsonb:=(select payload from claim_fixture where label='second'); begin
 if fresh->>'status'<>'claimed' or (fresh->>'epoch')::bigint<>2 or fresh->>'token'=old->>'token' then
  raise exception 'Successor did not fence old ownership'; end if;
 if public.tanaw_account_work_owned('83000000-0000-4000-8000-000000000001',1,(old->>'token')::uuid) then raise exception 'Stale ownership accepted'; end if;
 perform pg_temp.claim_deny(format('select public.tanaw_finish_account_work(%L,1,%L)','83000000-0000-4000-8000-000000000001',old->>'token'),'42501');
 perform pg_temp.claim_deny(format('select public.tanaw_finish_account_work(%L,2,%L)','83000000-0000-4000-8000-000000000001',old->>'token'),'42501');
end $$;
reset role;
insert into auth.users(id,email,raw_app_meta_data) select id,'claimed@fixture.invalid',
 '{"tanaw_provision_request_id":"83000000-0000-4000-8000-000000000001","tanaw_provision_school_id":"82000000-0000-4000-8000-000000000001"}'::jsonb
 from claim_fixture where label='target';
set local role service_role;
select public.tanaw_finish_account_work('83000000-0000-4000-8000-000000000001',2,
 (select (payload->>'token')::uuid from claim_fixture where label='second'));
select public.tanaw_finish_account_work('83000000-0000-4000-8000-000000000001',2,
 (select (payload->>'token')::uuid from claim_fixture where label='second'));
reset role;
do $$ begin
 if (select count(*) from public.tanaw_membership_events where target_user_id=(select id from claim_fixture where label='target'))<>1
  or (select revision from public.tanaw_memberships where user_id=(select id from claim_fixture where label='target'))<>1
  or (select actor_id from public.tanaw_membership_events where target_user_id=(select id from claim_fixture where label='target'))<>'81000000-0000-4000-8000-000000000001'::uuid then
  raise exception 'Claim completion lost atomicity/actor attribution'; end if;
end $$;
set local role authenticated;
select public.tanaw_complete_account('83000000-0000-4000-8000-000000000001');
reset role;
update public.tanaw_memberships set active=false where user_id='81000000-0000-4000-8000-000000000001';
set local role service_role;
select pg_temp.claim_deny($q$select public.tanaw_claim_account_work('83000000-0000-4000-8000-000000000001',60)$q$,'42501');
do $$ declare c jsonb:=(select payload from claim_fixture where label='second'); begin
 perform pg_temp.claim_deny(format('select public.tanaw_finish_account_work(%L,2,%L)','83000000-0000-4000-8000-000000000001',c->>'token'),'42501');
end $$;
rollback;
