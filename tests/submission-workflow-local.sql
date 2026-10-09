-- Synthetic adversarial end-to-end checks, rolled back. No actual records.
begin;
insert into auth.users(id,email) values
 ('41000000-0000-0000-0000-000000000001','workflow-teacher@fixture.invalid'),
 ('41000000-0000-0000-0000-000000000002','workflow-subject@fixture.invalid'),
 ('41000000-0000-0000-0000-000000000003','workflow-coordinator@fixture.invalid'),
 ('41000000-0000-0000-0000-000000000004','workflow-head@fixture.invalid'),
 ('41000000-0000-0000-0000-000000000005','workflow-district@fixture.invalid'),
 ('41000000-0000-0000-0000-000000000006','workflow-peer@fixture.invalid'),
 ('41000000-0000-0000-0000-000000000007','workflow-other@fixture.invalid');
insert into public.tanaw_schools(id,name) values
 ('42000000-0000-0000-0000-000000000001','Synthetic workflow school'),
 ('42000000-0000-0000-0000-000000000002','Synthetic other school');
insert into public.tanaw_memberships(school_id,user_id,roles,subject_ids) values
 ('42000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001',array['teacher','subjectCoordinator'],array['math']),
 ('42000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002',array['subjectCoordinator'],array['math']),
 ('42000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000003',array['smeaCoordinator','schoolHead'],array['math']),
 ('42000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000004',array['schoolHead'],'{}'),
 ('42000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000005',array['districtCoordinator'],'{}'),
 ('42000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000006',array['teacher'],array['math']),
 ('42000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000007',array['smeaCoordinator'],'{}');
insert into public.tanaw_instructional_blocks(id,school_year,label,end_date,source_order,source_url,verified_at) values
 ('43000000-0000-0000-0000-000000000001','Fixture','Fixture Block',current_date-1,'SYNTHETIC','https://fixture.invalid/calendar',now());
insert into public.tanaw_reporting_cycles(id,school_id,instructional_block_id,deadline_at,created_by) values
 ('44000000-0000-0000-0000-000000000001','42000000-0000-0000-0000-000000000001','43000000-0000-0000-0000-000000000001',now()+interval '1 day','41000000-0000-0000-0000-000000000003');
insert into public.smea_indicator_definitions(id,school_id,indicator_code,label,unit,school_year,reporting_period,definition_status,source_id,source_title,source_locator,formula_expression,numerator_definition,denominator_definition,rounding_rule) values
 ('45000000-0000-0000-0000-000000000001','42000000-0000-0000-0000-000000000001','FIXTURE','Synthetic manual indicator','count','Fixture','Fixture Block','verified','fixture','Fixture source','https://fixture.invalid/indicator','fixture expression','fixture numerator','fixture denominator','fixture rounding');
insert into public.smea_indicator_definitions(id,school_id,indicator_code,label,unit,school_year,reporting_period,definition_status,source_id,source_title,source_locator,formula_expression,numerator_definition,denominator_definition,rounding_rule)
 select '45000000-0000-0000-0000-000000000002',school_id,'FIXTURE2','Synthetic second indicator',unit,school_year,reporting_period,definition_status,source_id,source_title,source_locator,formula_expression,numerator_definition,denominator_definition,rounding_rule from public.smea_indicator_definitions where id='45000000-0000-0000-0000-000000000001';
create temp table fixture_targets(label text primary key,id uuid);
grant select,insert,update on fixture_targets to authenticated;
create function pg_temp.must_deny(statement text,expected_state text) returns void language plpgsql as $$
begin
 begin execute statement; exception when others then
  if sqlstate=expected_state then return; end if;
  raise;
 end;
 raise exception 'Expected denial %, but succeeded: %',expected_state,statement;
end; $$;
create function pg_temp.evidence(value numeric) returns jsonb language sql as $$
 select jsonb_build_object('kind','manualIndicators','entries',jsonb_build_array(jsonb_build_object('definitionId','45000000-0000-0000-0000-000000000001','value',value,'sourceTitle','Synthetic evidence','sourceLocator','https://fixture.invalid/record')));
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000003',true);
insert into fixture_targets values('teacherSlot',public.tanaw_assign_submission('44000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','math','Synthetic class A','Synthetic assignment'));
insert into fixture_targets values('coSlot',public.tanaw_assign_submission('44000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000003','math','Synthetic class B','Synthetic assignment'));
insert into fixture_targets select 'teacherSubmission',id from public.tanaw_submissions where slot_id=(select id from fixture_targets where label='teacherSlot');
insert into fixture_targets select 'coSubmission',id from public.tanaw_submissions where slot_id=(select id from fixture_targets where label='coSlot');
-- Unknown scope requirements cannot establish completeness.
select pg_temp.must_deny($s$select public.tanaw_prepare_packet('44000000-0000-0000-0000-000000000001','[]')$s$,'22023');
select public.tanaw_set_slot_requirements((select id from fixture_targets where label='teacherSubmission'),0,array['45000000-0000-0000-0000-000000000001'::uuid],'Synthetic requirements');
select public.tanaw_set_slot_requirements((select id from fixture_targets where label='coSubmission'),0,array['45000000-0000-0000-0000-000000000001'::uuid],'Synthetic requirements');
-- Handover subset is rolled back so the original end-to-end fixture remains unchanged.
savepoint handover_fixture;
select public.tanaw_handover_unsubmitted((select id from fixture_targets where label='teacherSubmission'),'41000000-0000-0000-0000-000000000006','41000000-0000-0000-0000-000000000001','Synthetic work handover');
do $$ begin
 if not exists(select 1 from public.tanaw_submission_handovers where previous_author='41000000-0000-0000-0000-000000000001' and next_author='41000000-0000-0000-0000-000000000006' and actor_id='41000000-0000-0000-0000-000000000003') then raise exception 'Handover attribution lost'; end if;
 if (select deadline_at from public.tanaw_reporting_cycles)<>now()+interval '1 day' or exists(select 1 from public.tanaw_submissions where extension_until is not null) then raise exception 'Handover changed deadline or extension'; end if;
end $$;
select pg_temp.must_deny(format('select public.tanaw_handover_unsubmitted(%L,%L,%L,%L)',(select id from fixture_targets where label='teacherSubmission'),'41000000-0000-0000-0000-000000000003','41000000-0000-0000-0000-000000000001','Stale author'),'40001');
select pg_temp.must_deny(format('select public.tanaw_handover_unsubmitted(%L,%L,%L,%L)',(select id from fixture_targets where label='teacherSubmission'),'41000000-0000-0000-0000-000000000007','41000000-0000-0000-0000-000000000006','Cross school target'),'22023');
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000001',true);
select pg_temp.must_deny(format('select public.tanaw_submit_evidence(%L,0,%L::jsonb,%L)',(select id from fixture_targets where label='teacherSubmission'),pg_temp.evidence(0),'Former author'),'42501');
select pg_temp.must_deny(format('select public.tanaw_handover_unsubmitted(%L,%L,%L,%L)',(select id from fixture_targets where label='teacherSubmission'),'41000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000006','Teacher takeover'),'42501');
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000006',true);
select public.tanaw_submit_evidence((select id from fixture_targets where label='teacherSubmission'),0,pg_temp.evidence(0),'Replacement author submission');
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000003',true);
select pg_temp.must_deny(format('select public.tanaw_handover_unsubmitted(%L,%L,%L,%L)',(select id from fixture_targets where label='teacherSubmission'),'41000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000006','Submitted evidence transfer'),'42501');
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000005',true);
do $$ begin if (select count(*) from public.tanaw_submission_handovers)<>0 then raise exception 'District read handover account details'; end if; end $$;
rollback to savepoint handover_fixture;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000001',true);
select public.tanaw_submit_evidence((select id from fixture_targets where label='teacherSubmission'),0,pg_temp.evidence(0),'Synthetic first submission');
do $$ begin
 if (select count(*) from public.tanaw_submission_slots)<>2 then raise exception 'assigned multi-role subject scope'; end if;
 if (select evidence#>>'{entries,0,value}' from public.tanaw_submission_versions)<>'0' then raise exception 'recorded zero lost'; end if;
end $$;
select pg_temp.must_deny(format('select public.tanaw_review_submission(%L,1)',(select id from fixture_targets where label='teacherSubmission')),'42501');
select pg_temp.must_deny(format('select public.tanaw_submit_evidence(%L,0,%L::jsonb,%L)',(select id from fixture_targets where label='teacherSubmission'),pg_temp.evidence(1),'stale'),'40001');
select pg_temp.must_deny(format('update public.tanaw_submission_versions set evidence=%L::jsonb',pg_temp.evidence(99)),'42501');
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000006',true);
do $$ begin if (select count(*) from public.tanaw_submission_versions)<>0 then raise exception 'peer read raw evidence'; end if; end $$;
select pg_temp.must_deny(format('select public.tanaw_submit_evidence(%L,1,%L::jsonb,%L)',(select id from fixture_targets where label='teacherSubmission'),pg_temp.evidence(1),'peer edit'),'42501');
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000002',true);
select public.tanaw_review_submission((select id from fixture_targets where label='teacherSubmission'),1);
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000001',true);
select public.tanaw_submit_evidence((select id from fixture_targets where label='teacherSubmission'),1,pg_temp.evidence(1),'Synthetic corrected upload');
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000003',true);
select pg_temp.must_deny($s$select public.tanaw_prepare_packet('44000000-0000-0000-0000-000000000001','[]')$s$,'42501');
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000002',true);
select public.tanaw_review_submission((select id from fixture_targets where label='teacherSubmission'),2);
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000003',true);
-- A reviewed submitted slot remains incomplete if a required indicator is absent.
savepoint partial_coverage;
select public.tanaw_set_slot_requirements((select id from fixture_targets where label='teacherSubmission'),2,array['45000000-0000-0000-0000-000000000001'::uuid,'45000000-0000-0000-0000-000000000002'::uuid],'Synthetic expanded requirements');
select pg_temp.must_deny(format('select public.tanaw_prepare_packet(%L,%L::jsonb)','44000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('slotId',(select id from fixture_targets where label='coSlot'),'reason','Missing'))),'22023');
insert into fixture_targets values('partialPacket',public.tanaw_prepare_packet('44000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('slotId',(select id from fixture_targets where label='coSlot'),'reason','Missing'),jsonb_build_object('slotId',(select id from fixture_targets where label='teacherSlot'),'reason','Second indicator missing'))));
do $$ begin if (select jsonb_array_length(missing) from public.tanaw_school_packets where id=(select id from fixture_targets where label='partialPacket'))<>2 then raise exception 'Partial coverage was treated as complete'; end if; end $$;
rollback to savepoint partial_coverage;
insert into fixture_targets values('packet1',public.tanaw_prepare_packet('44000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('slotId',(select id from fixture_targets where label='coSlot'),'reason','Synthetic missing reason'))));
select pg_temp.must_deny(format('select public.tanaw_lock_packet(%L)',(select id from fixture_targets where label='packet1')),'42501');
select public.tanaw_review_packet((select id from fixture_targets where label='packet1'),'school',false);
select pg_temp.must_deny(format('select public.tanaw_review_packet(%L,%L,true)',(select id from fixture_targets where label='packet1'),'head'),'42501');
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000004',true);
select pg_temp.must_deny(format('select public.tanaw_review_packet(%L,%L,false)',(select id from fixture_targets where label='packet1'),'head'),'22023');
select public.tanaw_review_packet((select id from fixture_targets where label='packet1'),'head',true);
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000003',true);
select public.tanaw_lock_packet((select id from fixture_targets where label='packet1'));
do $$ begin if (select completeness from public.tanaw_school_packets where id=(select id from fixture_targets where label='packet1'))<>'incomplete' then raise exception 'Incomplete label lost'; end if; end $$;
select pg_temp.must_deny(format('select public.tanaw_handover_unsubmitted(%L,%L,%L,%L)',(select id from fixture_targets where label='coSubmission'),'41000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000003','Locked handover'),'42501');
select pg_temp.must_deny(format('select public.tanaw_extend_submission(%L,now()+interval %L,%L)',(select id from fixture_targets where label='teacherSubmission'),'3 days','Locked extension'),'42501');
select pg_temp.must_deny(format('select public.tanaw_submit_evidence(%L,2,%L::jsonb,%L)',(select id from fixture_targets where label='teacherSubmission'),pg_temp.evidence(2),'Locked correction'),'42501');
select public.tanaw_open_amendment('44000000-0000-0000-0000-000000000001',now()+interval '2 days','Synthetic amendment');
-- Expired rounds remain in history and a new round can recover the cycle.
savepoint expiry_recovery;
reset role;
update public.tanaw_amendment_rounds set deadline_at=clock_timestamp()-interval '1 second' where closed_at is null;
set local role authenticated;
select public.tanaw_open_amendment('44000000-0000-0000-0000-000000000001',clock_timestamp()+interval '3 days','Synthetic expired round recovery');
do $$ begin if (select count(*) from public.tanaw_amendment_rounds where closed_at is not null)<>1 or (select count(*) from public.tanaw_amendment_rounds where closed_at is null)<>1 then raise exception 'Expiry recovery lost original or active round'; end if; end $$;
rollback to savepoint expiry_recovery;
select public.tanaw_submit_evidence((select id from fixture_targets where label='coSubmission'),0,pg_temp.evidence(2),'Synthetic missing submission amendment');
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000002',true);
select public.tanaw_review_submission((select id from fixture_targets where label='coSubmission'),1);
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000003',true);
insert into fixture_targets values('packet2',public.tanaw_prepare_packet('44000000-0000-0000-0000-000000000001','[]'));
select public.tanaw_review_packet((select id from fixture_targets where label='packet2'),'school',false);
select pg_temp.must_deny(format('select public.tanaw_review_packet(%L,%L,true)',(select id from fixture_targets where label='packet2'),'head'),'42501');
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000004',true);
select public.tanaw_review_packet((select id from fixture_targets where label='packet2'),'head',false);
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000003',true);
select public.tanaw_lock_packet((select id from fixture_targets where label='packet2'));
do $$ begin
 if (select count(*) from public.tanaw_school_packets where locked_at is not null)<>2 then raise exception 'Original locked packet overwritten'; end if;
 if not exists(select 1 from public.tanaw_packet_reviews where packet_id=(select id from fixture_targets where label='packet2') and stage='school' and self_review) then raise exception 'Coordinator self-review not recorded'; end if;
 if (select evidence#>>'{entries,0,value}' from public.tanaw_submission_versions where submission_id=(select id from fixture_targets where label='teacherSubmission') and version=1)<>'0' then raise exception 'Original evidence changed'; end if;
 if exists(select 1 from public.tanaw_amendment_rounds where closed_at is null) then raise exception 'Amendment not closed'; end if;
end $$;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000005',true);
do $$ begin
 if (select count(*) from public.tanaw_submission_versions)<>0 or (select count(*) from public.tanaw_school_packets)<>0 then raise exception 'District raw access'; end if;
 if (select count(*) from public.tanaw_district_packets('42000000-0000-0000-0000-000000000001'))<>2 then raise exception 'District aggregate projection missing'; end if;
end $$;
select pg_temp.must_deny(format('select public.tanaw_district_review_request(%L,%L,%L,%L,null)',(select id from fixture_targets where label='packet1'),'return',' ','46000000-0000-0000-0000-000000000001'),'22023');
select public.tanaw_district_review_request((select id from fixture_targets where label='packet1'),'return','Synthetic return comment','46000000-0000-0000-0000-000000000001',null);
-- Reloaded retries with a fresh request identity also reconcile the unchanged decision.
select public.tanaw_district_review_request((select id from fixture_targets where label='packet1'),'return','Synthetic return comment','46000000-0000-0000-0000-000000000009',(select id from public.tanaw_district_decisions where packet_id=(select id from fixture_targets where label='packet1')));
-- A retry after an interrupted response reconciles rather than duplicating.
select public.tanaw_district_review_request((select id from fixture_targets where label='packet1'),'return','Synthetic return comment','46000000-0000-0000-0000-000000000001',null);
select pg_temp.must_deny(format('select public.tanaw_district_review_request(%L,%L,%L,%L,null)',(select id from fixture_targets where label='packet1'),'return','Changed payload','46000000-0000-0000-0000-000000000001'),'40001');
select pg_temp.must_deny(format('select public.tanaw_district_review_request(%L,%L,%L,%L,null)',(select id from fixture_targets where label='packet1'),'return','Stale changed decision','46000000-0000-0000-0000-000000000002'),'40001');
select pg_temp.must_deny(format('select public.tanaw_district_review_request(%L,%L,%L,%L,null)',(select id from fixture_targets where label='packet2'),'accept','Unsupported acceptance','46000000-0000-0000-0000-000000000003'),'22023');
select public.tanaw_district_review_request((select id from fixture_targets where label='packet2'),'return','Synthetic second packet return','46000000-0000-0000-0000-000000000003',null);
do $$ begin if (select count(*) from public.tanaw_district_decisions)<>2 then raise exception 'District retry duplicated history'; end if; end $$;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000001',true);
do $$ begin if (select count(*) from public.tanaw_school_feedback('44000000-0000-0000-0000-000000000001'))<>2 then raise exception 'School feedback unreadable'; end if; end $$;
select set_config('request.jwt.claim.sub','41000000-0000-0000-0000-000000000007',true);
select pg_temp.must_deny($s$select public.tanaw_school_feedback('44000000-0000-0000-0000-000000000001')$s$,'42501');
select pg_temp.must_deny($s$select public.tanaw_district_packets('42000000-0000-0000-0000-000000000001')$s$,'42501');
do $$ begin if (select count(*) from public.tanaw_submission_versions)<>0 then raise exception 'Cross-school raw access'; end if; end $$;
reset role;
rollback;
