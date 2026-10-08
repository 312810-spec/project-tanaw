-- Synthetic only; never provision real calendar dates or accounts here.
begin;
insert into auth.users(id,email) values
 ('31000000-0000-0000-0000-000000000001','cycle-coordinator@fixture.invalid'),
 ('31000000-0000-0000-0000-000000000002','cycle-teacher@fixture.invalid');
insert into public.tanaw_schools(id,name) values
 ('32000000-0000-0000-0000-000000000001','Synthetic cycle school'),
 ('32000000-0000-0000-0000-000000000002','Other synthetic school');
insert into public.tanaw_memberships(school_id,user_id,roles) values
 ('32000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001',array['smeaCoordinator']),
 ('32000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000002',array['teacher']);
insert into public.tanaw_instructional_blocks(id,school_year,label,end_date,source_order,source_url,verified_at)
 values('33000000-0000-0000-0000-000000000001','Synthetic only','Fixture block',current_date - 1,
 'SYNTHETIC-NOT-DEPEd','https://fixture.invalid/calendar',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000002',true);
do $$
begin
 begin
  perform public.tanaw_set_cycle_deadline('32000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001',now()+interval '1 day',0,'test');
  raise exception 'teacher changed deadline';
 exception when insufficient_privilege then null;
 end;
 begin
  update public.tanaw_instructional_blocks set end_date=current_date;
  raise exception 'client changed official calendar';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
select public.tanaw_set_cycle_deadline('32000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001',now()+interval '1 day',0,'Synthetic create');
do $$
begin
 if (select count(*) from public.tanaw_reporting_cycles) <> 1 then raise exception 'cycle missing'; end if;
 if (select count(*) from public.tanaw_cycle_events) <> 1 then raise exception 'audit missing'; end if;
 begin
  perform public.tanaw_set_cycle_deadline('32000000-0000-0000-0000-000000000002','33000000-0000-0000-0000-000000000001',now()+interval '1 day',0,'test');
  raise exception 'cross-school allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.tanaw_set_cycle_deadline('32000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001',now()+interval '1 day',0,'test');
  raise exception 'stale revision allowed';
 exception when serialization_failure then null;
 end;
 begin
  perform public.tanaw_set_cycle_deadline('32000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001',now()-interval '1 day',1,'test');
  raise exception 'past deadline allowed';
 exception when invalid_parameter_value then null;
 end;
 begin
  perform public.tanaw_set_cycle_deadline('32000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001',now()+interval '2 days',1,' ');
  raise exception 'reasonless change allowed';
 exception when invalid_parameter_value then null;
 end;
end $$;
select public.tanaw_set_cycle_deadline('32000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001',now()+interval '2 days',1,'Synthetic update');
reset role;
do $$
begin
 if (select revision from public.tanaw_reporting_cycles) <> 2 then raise exception 'revision not incremented'; end if;
 if (select count(*) from public.tanaw_cycle_events) <> 2 then raise exception 'history missing'; end if;
 if (select end_date from public.tanaw_instructional_blocks) <> current_date-1 then raise exception 'calendar altered'; end if;
end $$;
update public.tanaw_reporting_cycles set deadline_at=now()-interval '1 day';
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
do $$
begin
 begin
  perform public.tanaw_set_cycle_deadline('32000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001',now()+interval '3 days',2,'test');
  raise exception 'closed deadline reopened';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
update public.tanaw_reporting_cycles set deadline_at=now()+interval '1 day',locked_at=now();
set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-0000-0000-000000000001',true);
do $$
begin
 begin
  perform public.tanaw_set_cycle_deadline('32000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001',now()+interval '3 days',2,'test');
  raise exception 'locked deadline changed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
