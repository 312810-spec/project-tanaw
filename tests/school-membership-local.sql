-- Synthetic fixture only; rolled back. Test real role grants, RLS and RPC.
begin;
insert into auth.users (id,email) values
 ('10000000-0000-0000-0000-000000000001','coordinator@fixture.invalid'),
 ('10000000-0000-0000-0000-000000000002','teacher@fixture.invalid'),
 ('10000000-0000-0000-0000-000000000003','other@fixture.invalid');
insert into public.tanaw_schools (id,name) values
 ('20000000-0000-0000-0000-000000000001','Synthetic school A'),
 ('20000000-0000-0000-0000-000000000002','Synthetic school B');
insert into public.tanaw_memberships (school_id,user_id,roles,subject_ids) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',array['smeaCoordinator'], '{}'),
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',array['teacher'],array['math']),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003',array['smeaCoordinator'],'{}');
do $$
begin
 if has_table_privilege('anon','public.tanaw_memberships','select') then raise exception 'anon read grant'; end if;
 if has_table_privilege('authenticated','public.tanaw_memberships','insert,update,delete') then raise exception 'direct write grant'; end if;
 if has_table_privilege('authenticated','public.smea_indicator_evidence','select') then raise exception 'raw evidence grant'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$
begin
 if (select count(*) from public.tanaw_schools) <> 1 then raise exception 'school isolation'; end if;
 if (select count(*) from public.tanaw_memberships) <> 1 then raise exception 'teacher membership scope'; end if;
 begin
   perform public.tanaw_manage_member('20000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000003',array['schoolHead'],'{}',true,'Synthetic test');
   raise exception 'teacher gained admin access';
 exception when insufficient_privilege then null;
 end;
 begin
   update public.tanaw_memberships set roles = array['smeaCoordinator'];
   raise exception 'direct write allowed';
 exception when insufficient_privilege then null;
 end;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$
begin
 if (select count(*) from public.tanaw_memberships) <> 2 then raise exception 'coordinator scope'; end if;
 begin
   perform public.tanaw_manage_member('20000000-0000-0000-0000-000000000002',
     '10000000-0000-0000-0000-000000000003',array['teacher'],'{}',true,'Synthetic test');
   raise exception 'cross-school manage allowed';
 exception when insufficient_privilege then null;
 end;
 begin
   perform public.tanaw_manage_member('20000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000001',array['schoolHead'],'{}',true,'Synthetic test');
   raise exception 'self-assignment allowed';
 exception when insufficient_privilege then null;
 end;
 begin
   perform public.tanaw_manage_member('20000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000002',array['teacher'],'{}',true,' ');
   raise exception 'reasonless change allowed';
 exception when invalid_parameter_value then null;
 end;
end $$;
select public.tanaw_manage_member('20000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000002',array['teacher','subjectCoordinator'],array['math'],true,'Synthetic reassignment');
do $$
begin
 if (select count(*) from public.tanaw_membership_events) <> 1 then raise exception 'missing audit event'; end if;
 if not exists(select 1 from public.tanaw_membership_events
   where actor_id='10000000-0000-0000-0000-000000000001'
   and before_value->'roles' = '["teacher"]'::jsonb
   and after_value->'roles' = '["teacher", "subjectCoordinator"]'::jsonb)
 then raise exception 'audit snapshots incorrect'; end if;
end $$;
select public.tanaw_manage_member('20000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000002',array['teacher'],array['math'],false,'Synthetic disable');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$
begin
 if (select count(*) from public.tanaw_memberships) <> 0 then raise exception 'disabled user has membership access'; end if;
 if (select count(*) from public.tanaw_schools) <> 0 then raise exception 'disabled user has school access'; end if;
end $$;
reset role;
do $$
begin
 if (select count(*) from public.tanaw_membership_events) <> 2 then raise exception 'history missing'; end if;
 if (select count(*) from public.tanaw_memberships) <> 3 then raise exception 'membership history deleted'; end if;
end $$;
rollback;
