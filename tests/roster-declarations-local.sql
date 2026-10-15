-- Synthetic, rollback-only source declarations. No approved roster or real identity.
begin;
insert into auth.users(id,email) values
 ('61000000-0000-0000-0000-000000000001','co-a@fixture.invalid'),
 ('61000000-0000-0000-0000-000000000002','teacher@fixture.invalid'),
 ('61000000-0000-0000-0000-000000000003','subject@fixture.invalid'),
 ('61000000-0000-0000-0000-000000000004','district@fixture.invalid'),
 ('61000000-0000-0000-0000-000000000005','co-b@fixture.invalid'),
 ('61000000-0000-0000-0000-000000000006','disabled@fixture.invalid');
insert into public.tanaw_schools(id,name) values
 ('62000000-0000-0000-0000-000000000001','Synthetic A'),('62000000-0000-0000-0000-000000000002','Synthetic B');
insert into public.tanaw_memberships(school_id,user_id,roles,subject_ids,active) values
 ('62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001',array['smeaCoordinator'],'{}',true),
 ('62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000002',array['teacher'],array['math'],true),
 ('62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000003',array['subjectCoordinator'],array['math'],true),
 ('62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000004',array['districtCoordinator'],'{}',true),
 ('62000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000005',array['smeaCoordinator'],'{}',true),
 ('62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000006',array['smeaCoordinator'],'{}',false);
insert into public.tanaw_instructional_blocks(id,school_year,label,end_date,source_order,source_url,verified_at)
 values('63000000-0000-0000-0000-000000000001','FixtureYear','Synthetic block',current_date,'SYNTHETIC','https://fixture.invalid/calendar',now());
insert into public.tanaw_reporting_cycles(id,school_id,instructional_block_id,deadline_at,created_by) values
 ('64000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001',now()+interval '1 day','61000000-0000-0000-0000-000000000001'),
 ('64000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000001',now()+interval '1 day','61000000-0000-0000-0000-000000000005');
create temp table fixture_roster_targets(label text primary key,id uuid);
grant all on fixture_roster_targets to authenticated;
create function pg_temp.roster_payload() returns jsonb language sql as $$
 select jsonb_build_object('schema','tanaw-roster-declaration-v1','sourceTitle','Synthetic roster source',
  'sourceLocator','https://fixture.invalid/roster','sourceRevision','fixture-1','classReference','synthetic-class-id',
  'schoolYear','FixtureYear','term','TERM 1','sourceHash',repeat('a',64),'learnerKeys',jsonb_build_array('synthetic-key-a','synthetic-key-b'));
$$;
create function pg_temp.roster_must_deny(stmt text,code text) returns void language plpgsql as $$
begin
 begin execute stmt;
 exception when others then if sqlstate=code then return; else raise; end if; end;
 raise exception 'Expected roster denial %',code;
end $$;
do $$
declare p jsonb := pg_temp.roster_payload(); bad jsonb;
begin
 if not (select relrowsecurity from pg_class where oid='public.tanaw_roster_declarations'::regclass)
  or has_table_privilege('authenticated','public.tanaw_roster_declarations','INSERT,UPDATE,DELETE')
  or has_table_privilege('anon','public.tanaw_roster_declarations','SELECT')
  or has_function_privilege('anon','public.tanaw_declare_roster_source(uuid,integer,uuid,jsonb)','EXECUTE') then
  raise exception 'Roster ACL or RLS is not fail-closed'; end if;
 if not tanaw_private.valid_roster_declaration(p) then raise exception 'Synthetic declaration rejected'; end if;
 for bad in select value from jsonb_array_elements(jsonb_build_array(
  null,'{}'::jsonb,p-'sourceTitle',p||'{"extraPrivateField":"not-stored"}',p||'{"term":"TERM 4"}',
  p||'{"sourceHash":"wrong"}',p||'{"learnerKeys":[]}',p||'{"learnerKeys":["duplicate","duplicate"]}',
  p||'{"learnerKeys":[" padded "]}',p||'{"learnerKeys":[null]}',p||'{"learnerKeys":[1]}',p||'{"sourceRevision":0}'
 )) loop
  if tanaw_private.valid_roster_declaration(bad) then raise exception 'Invalid roster payload accepted'; end if;
 end loop;
 if tanaw_private.valid_roster_declaration(p||jsonb_build_object('learnerKeys',(select jsonb_agg('key-'||n) from generate_series(1,1001) n))) then
  raise exception 'Oversized roster accepted'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
insert into fixture_roster_targets select 'slotA',public.tanaw_assign_submission('64000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000002','math','Synthetic class A','Synthetic assignment');
insert into fixture_roster_targets select 'subA',id from public.tanaw_submissions where slot_id=(select id from fixture_roster_targets where label='slotA');
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000005',true);
insert into fixture_roster_targets select 'slotB',public.tanaw_assign_submission('64000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000005','math','Synthetic class B','Synthetic assignment');
insert into fixture_roster_targets select 'subB',id from public.tanaw_submissions where slot_id=(select id from fixture_roster_targets where label='slotB');
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
insert into fixture_roster_targets select 'declaration1',public.tanaw_declare_roster_source((select id from fixture_roster_targets where label='subA'),0,'65000000-0000-0000-0000-000000000001',pg_temp.roster_payload());
do $$ begin
 if public.tanaw_declare_roster_source((select id from fixture_roster_targets where label='subA'),0,'65000000-0000-0000-0000-000000000001',pg_temp.roster_payload())<>(select id from fixture_roster_targets where label='declaration1') then raise exception 'Retry did not reconcile'; end if;
 if not exists(select 1 from public.tanaw_roster_declarations where revision=1 and state='pending' and payload=pg_temp.roster_payload() and created_by='61000000-0000-0000-0000-000000000001') then raise exception 'Provenance/state lost'; end if;
end $$;
select pg_temp.roster_must_deny(format('select public.tanaw_declare_roster_source(%L,0,%L,%L::jsonb)',(select id from fixture_roster_targets where label='subA'),'65000000-0000-0000-0000-000000000001',pg_temp.roster_payload()||'{"sourceRevision":"changed"}'),'22023');
select pg_temp.roster_must_deny(format('select public.tanaw_declare_roster_source(%L,0,%L,%L::jsonb)',(select id from fixture_roster_targets where label='subA'),'65000000-0000-0000-0000-000000000002',pg_temp.roster_payload()),'40001');
select pg_temp.roster_must_deny(format('select public.tanaw_declare_roster_source(%L,1,%L,%L::jsonb)',(select id from fixture_roster_targets where label='subA'),'65000000-0000-0000-0000-000000000002',pg_temp.roster_payload()||'{"schoolYear":"other-year"}'),'22023');
select pg_temp.roster_must_deny(format('select public.tanaw_declare_roster_source(%L,0,%L,%L::jsonb)',(select id from fixture_roster_targets where label='subB'),'65000000-0000-0000-0000-000000000002',pg_temp.roster_payload()),'42501');
select public.tanaw_declare_roster_source((select id from fixture_roster_targets where label='subA'),1,'65000000-0000-0000-0000-000000000002',pg_temp.roster_payload()||'{"sourceRevision":"fixture-2"}');
select pg_temp.roster_must_deny(format('select public.tanaw_declare_roster_source(%L,2,%L,%L::jsonb)',(select id from fixture_roster_targets where label='subA'),'65000000-0000-0000-0000-000000000003',pg_temp.roster_payload()||'{"learnerKeys":["duplicate","duplicate"]}'),'22023');
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
do $$ begin if (select count(*) from public.tanaw_roster_declarations)<>2 then raise exception 'Assigned teacher cannot inspect pending source'; end if; end $$;
select pg_temp.roster_must_deny(format('select public.tanaw_declare_roster_source(%L,2,%L,%L::jsonb)',(select id from fixture_roster_targets where label='subA'),'65000000-0000-0000-0000-000000000003',pg_temp.roster_payload()),'42501');
select pg_temp.roster_must_deny('delete from public.tanaw_roster_declarations','42501');
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000003',true);
do $$ begin if (select count(*) from public.tanaw_roster_declarations)<>2 then raise exception 'Subject scope read failed'; end if; end $$;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000004',true);
do $$ begin if exists(select 1 from public.tanaw_roster_declarations) then raise exception 'District read private keys'; end if; end $$;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000005',true);
do $$ begin if exists(select 1 from public.tanaw_roster_declarations) then raise exception 'Cross-school read'; end if; end $$;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000006',true);
do $$ begin if exists(select 1 from public.tanaw_roster_declarations) then raise exception 'Disabled read'; end if; end $$;
select pg_temp.roster_must_deny(format('select public.tanaw_declare_roster_source(%L,2,%L,%L::jsonb)',(select id from fixture_roster_targets where label='subA'),'65000000-0000-0000-0000-000000000003',pg_temp.roster_payload()),'42501');
reset role;
update public.tanaw_memberships set active=false where user_id='61000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
select pg_temp.roster_must_deny(format('select public.tanaw_declare_roster_source(%L,0,%L,%L::jsonb)',(select id from fixture_roster_targets where label='subA'),'65000000-0000-0000-0000-000000000001',pg_temp.roster_payload()),'42501');
do $$ begin if exists(select 1 from public.tanaw_roster_declarations) then raise exception 'Revoked coordinator retained access'; end if; end $$;
reset role;
select pg_temp.roster_must_deny('update public.tanaw_roster_declarations set state=''approved''','42501');
select pg_temp.roster_must_deny('delete from public.tanaw_roster_declarations','42501');
do $$ begin
 if (select count(*) from public.tanaw_roster_declarations)<>2 or exists(select 1 from public.tanaw_roster_declarations where state<>'pending') then raise exception 'History or pending gate changed'; end if;
 if exists(select 1 from public.tanaw_submissions where current_version<>0) or exists(select 1 from public.tanaw_submission_versions) then raise exception 'Declaration changed evidence'; end if;
end $$;
rollback;
