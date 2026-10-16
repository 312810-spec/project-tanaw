-- Synthetic reservation/RLS/finalization checks; rollback all fixture records.
begin;
insert into auth.users(id,email) values
 ('71000000-0000-4000-8000-000000000001','co-a@fixture.invalid'),
 ('71000000-0000-4000-8000-000000000002','co-b@fixture.invalid'),
 ('71000000-0000-4000-8000-000000000003','teacher@fixture.invalid'),
 ('71000000-0000-4000-8000-000000000004','district@fixture.invalid');
insert into public.tanaw_schools(id,name) values
 ('72000000-0000-4000-8000-000000000001','Synthetic provisioning A'),
 ('72000000-0000-4000-8000-000000000002','Synthetic provisioning B');
insert into public.tanaw_memberships(school_id,user_id,roles,subject_ids) values
 ('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001',array['smeaCoordinator'],'{}'),
 ('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002',array['smeaCoordinator'],'{}'),
 ('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000003',array['teacher'],array['math']),
 ('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000004',array['districtCoordinator'],'{}');
create temp table provision_fixture_ids(label text primary key,id uuid);
grant all on provision_fixture_ids to authenticated;
create function pg_temp.prov_deny(stmt text,code text) returns void language plpgsql as $$
begin
 begin execute stmt;
 exception when others then if sqlstate=code then return; else raise; end if; end;
 raise exception 'Expected provisioning denial %',code;
end $$;
do $$ begin
 if not (select relrowsecurity from pg_class where oid='public.tanaw_provisioning_requests'::regclass)
  or has_table_privilege('authenticated','public.tanaw_provisioning_requests','INSERT,UPDATE,DELETE')
  or has_table_privilege('anon','public.tanaw_provisioning_requests','SELECT')
  or has_function_privilege('anon','public.tanaw_complete_account(uuid)','EXECUTE')
  or has_function_privilege('service_role','public.tanaw_complete_account(uuid)','EXECUTE') then
  raise exception 'Provisioning ACL/RLS failed'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
insert into provision_fixture_ids select 'reserved',public.tanaw_reserve_account(
 '72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001',
 ' New-User@fixture.invalid ',array['teacher'],array['science','math'],'Synthetic account request');
do $$ declare result_id uuid; begin
 result_id:=public.tanaw_reserve_account('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001',
  'new-user@fixture.invalid',array['teacher'],array['math','science'],'Synthetic account request');
 if result_id<>(select id from provision_fixture_ids where label='reserved') or
  (select count(*) from public.tanaw_provisioning_requests)<>1 then raise exception 'Exact reservation retry failed'; end if;
 perform pg_temp.prov_deny($q$select public.tanaw_reserve_account('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','changed@fixture.invalid',array['teacher'],array['math'],'Synthetic account request')$q$,'22023');
 perform pg_temp.prov_deny($q$select public.tanaw_reserve_account('72000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000002','other@fixture.invalid',array['teacher'],array['math'],'Synthetic')$q$,'42501');
 perform pg_temp.prov_deny($q$select public.tanaw_reserve_account('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000002','new-user@fixture.invalid',array['teacher'],array['math'],'Synthetic')$q$,'40001');
 perform pg_temp.prov_deny($q$select public.tanaw_reserve_account('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000002','invalid',array['teacher'],array['math'],'Synthetic')$q$,'22023');
 perform pg_temp.prov_deny($q$select public.tanaw_reserve_account('72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000002','valid@fixture.invalid',array['service_role'],array['math'],'Synthetic')$q$,'22023');
 perform pg_temp.prov_deny($q$select public.tanaw_complete_account('73000000-0000-4000-8000-000000000001')$q$,'22023');
 perform pg_temp.prov_deny($q$update public.tanaw_provisioning_requests set reason='overwrite'$q$,'42501');
end $$;
-- Another coordinator, a teacher and district cannot read or complete this request.
do $$ declare actor text; begin
 foreach actor in array array['71000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000004'] loop
  perform set_config('request.jwt.claim.sub',actor,true);
  if exists(select 1 from public.tanaw_provisioning_requests) then raise exception 'Request privacy leak'; end if;
  perform pg_temp.prov_deny($q$select public.tanaw_complete_account('73000000-0000-4000-8000-000000000001')$q$,'42501');
 end loop;
end $$;
reset role;
-- Test-operator Auth setup: user metadata cannot substitute for trusted app metadata.
insert into auth.users(id,email,raw_user_meta_data) select id,'new-user@fixture.invalid',
 '{"tanaw_provision_request_id":"73000000-0000-4000-8000-000000000001","tanaw_provision_school_id":"72000000-0000-4000-8000-000000000001"}'::jsonb
 from provision_fixture_ids where label='reserved';
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select pg_temp.prov_deny($q$select public.tanaw_complete_account('73000000-0000-4000-8000-000000000001')$q$,'22023');
reset role;
update auth.users set raw_app_meta_data=raw_user_meta_data where id=(select id from provision_fixture_ids where label='reserved');
set local role authenticated;
-- Inject an outer transaction failure after completion: all three DB writes roll back.
do $$ begin
 begin
  perform public.tanaw_complete_account('73000000-0000-4000-8000-000000000001');
  raise exception 'Synthetic interruption' using errcode='P0001';
 exception when sqlstate 'P0001' then null; end;
 if exists(select 1 from public.tanaw_memberships where user_id=(select id from provision_fixture_ids where label='reserved'))
  or exists(select 1 from public.tanaw_membership_events where target_user_id=(select id from provision_fixture_ids where label='reserved'))
  or exists(select 1 from public.tanaw_provisioning_requests where completed_at is not null) then
  raise exception 'Completion rollback left partial state'; end if;
 perform public.tanaw_complete_account('73000000-0000-4000-8000-000000000001');
 perform public.tanaw_complete_account('73000000-0000-4000-8000-000000000001');
 if (select count(*) from public.tanaw_membership_events where target_user_id=(select id from provision_fixture_ids where label='reserved'))<>1
  or (select revision from public.tanaw_memberships where user_id=(select id from provision_fixture_ids where label='reserved'))<>1 then
  raise exception 'Completion retry duplicated access'; end if;
end $$;
-- A later independent disable must not be undone by replaying completion.
select public.tanaw_manage_member('72000000-0000-4000-8000-000000000001',
 (select id from provision_fixture_ids where label='reserved'),array['teacher'],array['math'],false,'Synthetic later disable',1);
select public.tanaw_complete_account('73000000-0000-4000-8000-000000000001');
do $$ begin
 if exists(select 1 from public.tanaw_memberships where user_id=(select id from provision_fixture_ids where label='reserved') and (active or revision<>2)) then
  raise exception 'Historical receipt reactivated membership'; end if;
end $$;
reset role;
update public.tanaw_memberships set active=false where user_id='71000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
select pg_temp.prov_deny($q$select public.tanaw_complete_account('73000000-0000-4000-8000-000000000001')$q$,'42501');
do $$ begin
 if exists(select 1 from public.tanaw_provisioning_requests) then raise exception 'Disabled actor can read requests'; end if;
end $$;
rollback;
