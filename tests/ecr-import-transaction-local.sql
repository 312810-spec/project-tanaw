-- Test-only PostgreSQL mechanism fixture. No production schema or import RPC.
-- All objects are session-local; all writes are rolled back. Synthetic IDs only.
begin;
create temp table import_targets (
 id integer primary key, owner_id integer not null, active boolean not null,
 locked boolean not null default false, ready boolean not null default false,
 current_version integer not null default 0, deadline timestamptz not null
) on commit drop;
create temp table import_history (
 target_id integer references import_targets, version integer not null,
 request_id integer not null, stage_id integer not null, payload jsonb not null,
 review_state text not null check (review_state='working'),
 primary key(target_id,version), unique(target_id,request_id), unique(target_id,stage_id)
) on commit drop;
create temp table import_receipts (
 target_id integer, request_id integer, version integer not null,
 primary key(target_id,request_id),
 foreign key(target_id,version) references import_history(target_id,version)
) on commit drop;
insert into import_targets values
 (1,101,true,false,true,0,clock_timestamp()+interval '1 hour'),
 (2,202,true,false,true,0,clock_timestamp()+interval '1 hour');

-- Session-local test function, not SECURITY DEFINER and never granted to app roles.
-- The ready flag is a synthetic precondition, not actual source/mapping approval.
create function pg_temp.simulate_import(target integer,actor integer,request integer,
 stage integer,expected integer,rows_json jsonb,fail_after_history boolean default false)
returns integer language plpgsql as $$
declare t import_targets%rowtype; prior import_history%rowtype; v integer;
begin
 select * into strict t from import_targets where id=target for update;
 if actor is distinct from t.owner_id or not t.active then
  raise exception 'access denied' using errcode='42501'; end if;
 if expected is null or expected<0 or request is null or request<1 or stage is null or stage<1 then
  raise exception 'invalid request' using errcode='22023'; end if;
 if rows_json is null or jsonb_typeof(rows_json)<>'array' then
  raise exception 'invalid batch' using errcode='22023'; end if;
 if jsonb_array_length(rows_json) not between 1 and 100 then
  raise exception 'invalid batch' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(rows_json) r where
   jsonb_typeof(r)<>'object' or jsonb_typeof(r->'key') is distinct from 'string'
   or nullif(btrim(r->>'key'),'') is null or not r ? 'value'
   or (jsonb_typeof(r->'value') not in ('number','null')))
 then raise exception 'invalid batch' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(rows_json) r
   where jsonb_typeof(r->'value')='number' and (r->>'value')::numeric<0)
   or (select count(distinct r->>'key') from jsonb_array_elements(rows_json) r)<>jsonb_array_length(rows_json)
 then raise exception 'invalid batch' using errcode='22023'; end if;
 select * into prior from import_history where target_id=target and request_id=request;
 if found then
  if prior.stage_id<>stage or prior.version<>expected+1 or prior.payload<>rows_json then
   raise exception 'request conflict' using errcode='22023'; end if;
  select version into strict v from import_receipts where target_id=target and request_id=request;
  return v;
 end if;
 if t.locked or not t.ready or clock_timestamp()>=t.deadline then
  raise exception 'write gated' using errcode='42501'; end if;
 if expected is distinct from t.current_version then
  raise exception 'version conflict' using errcode='40001'; end if;
 v:=t.current_version+1;
 insert into import_history values(target,v,request,stage,rows_json,'working');
 if fail_after_history then raise exception 'synthetic interruption' using errcode='P0001'; end if;
 insert into import_receipts values(target,request,v);
 update import_targets set current_version=v where id=target;
 return v;
end $$;

create function pg_temp.import_must_deny(stmt text,code text) returns void language plpgsql as $$
begin
 begin execute stmt;
 exception when others then if sqlstate=code then return; else raise; end if; end;
 raise exception 'Expected import denial %',code;
end $$;

do $$
declare p jsonb:='[{"key":"synthetic-a","value":0},{"key":"synthetic-b","value":null}]';
 bad jsonb; v integer;
begin
 -- A failure after writing history must roll back history, receipt and version.
 perform pg_temp.import_must_deny(format('select pg_temp.simulate_import(1,101,1,1,0,%L,true)',p),'P0001');
 if exists(select 1 from import_history) or exists(select 1 from import_receipts)
  or (select current_version from import_targets where id=1)<>0 then
  raise exception 'Interrupted transaction left partial writes'; end if;
 for bad in select value from jsonb_array_elements('[[],[null],[{"key":"a"}],[{"key":"a","value":-1}],[{"key":"a","value":"0"}],[{"key":"a","value":0},{"key":"a","value":1}]]') loop
  perform pg_temp.import_must_deny(format('select pg_temp.simulate_import(1,101,1,1,0,%L)',bad),'22023');
 end loop;
 perform pg_temp.import_must_deny(format('select pg_temp.simulate_import(1,202,1,1,0,%L)',p),'42501');
 perform pg_temp.import_must_deny(format('select pg_temp.simulate_import(1,101,1,1,null,%L)',p),'22023');
 perform pg_temp.import_must_deny(format('select pg_temp.simulate_import(2,101,1,1,0,%L)',p),'42501');
 v:=pg_temp.simulate_import(1,101,1,1,0,p);
 if v<>1 or (select current_version from import_targets where id=1)<>1
  or (select payload from import_history where target_id=1 and version=1)<>p
  or (select count(*) from import_receipts)<>1 then raise exception 'Commit mismatch'; end if;
 -- Stale second writer cannot overwrite the committed version (sequential CAS test).
 perform pg_temp.import_must_deny(format('select pg_temp.simulate_import(1,101,2,2,0,%L)',p),'40001');
 perform pg_temp.import_must_deny('select pg_temp.simulate_import(1,101,1,1,0,''[{"key":"changed","value":1}]'')','22023');
 -- A consumed stage cannot be reused under another request, even at current version.
 perform pg_temp.import_must_deny(format('select pg_temp.simulate_import(1,101,2,1,1,%L)',p),'23505');
 if (select count(*) from import_history)<>1 or (select count(*) from import_receipts)<>1 then
  raise exception 'Rejected write changed history'; end if;
 update import_targets set locked=true,deadline=clock_timestamp()-interval '1 second' where id=1;
 if pg_temp.simulate_import(1,101,1,1,0,p)<>1 then raise exception 'Lost receipt not recovered'; end if;
 perform pg_temp.import_must_deny(format('select pg_temp.simulate_import(1,101,2,2,1,%L)',p),'42501');
 update import_targets set active=false where id=1;
 perform pg_temp.import_must_deny(format('select pg_temp.simulate_import(1,101,1,1,0,%L)',p),'42501');
 update import_targets set ready=false where id=2;
 perform pg_temp.import_must_deny(format('select pg_temp.simulate_import(2,202,1,1,0,%L)',p),'42501');
end $$;
rollback;
