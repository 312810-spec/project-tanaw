-- Synthetic, rollback-only integration checks against isolated local Supabase.
begin;
do $verify$
declare
  school_one uuid := gen_random_uuid();
  school_two uuid := gen_random_uuid();
  definition_one uuid;
  caught boolean := false;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.smea_indicator_definitions'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.smea_indicator_evidence'::regclass) then
    raise exception 'SMEA RLS not enabled';
  end if;
  if has_table_privilege('authenticated', 'public.smea_indicator_definitions', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.smea_indicator_evidence', 'INSERT')
    or has_table_privilege('anon', 'public.smea_indicator_definitions', 'SELECT') then
    raise exception 'SMEA client grants are not fail-closed';
  end if;
  insert into public.smea_indicator_definitions
    (school_id, indicator_code, label, unit, school_year, reporting_period,
     source_id, source_title, source_locator)
  values
    (school_one, 'SYNTHETIC-ONLY', 'Synthetic test', 'count', '2026-2027',
     'term-1', 'fixture-source', 'Fixture', 'A1')
  returning id into definition_one;
  insert into public.smea_indicator_evidence
    (school_id, definition_id, scope_id, evidence_state, missing_reason)
  values (school_one, definition_one, 'fixture-scope', 'missing', 'Uncollected');
  insert into public.smea_indicator_evidence
    (school_id, definition_id, scope_id, evidence_state,
     number_value, source_id, source_title, source_locator)
  values (school_one, definition_one, 'fixture-scope', 'recorded',
    0, 'fixture-source', 'Fixture', 'B2');
  if (select count(*) from public.smea_indicator_evidence where definition_id = definition_one) <> 2 then
    raise exception 'Missing and evidenced zero were not stored distinctly';
  end if;
  caught := false;
  begin
    insert into public.smea_indicator_evidence
      (school_id, definition_id, scope_id, evidence_state, missing_reason)
    values (school_two, definition_one, 'scope', 'missing', 'Not provided');
  exception when foreign_key_violation then
    caught := true;
  end;
  if not caught then raise exception 'Cross-school evidence link accepted'; end if;
  caught := false;
  begin
    insert into public.smea_indicator_evidence
      (school_id, definition_id, scope_id, evidence_state, number_value)
    values (school_one, definition_one, 'scope', 'recorded', 0);
  exception when check_violation then
    caught := true;
  end;
  if not caught then raise exception 'Recorded observation accepted without provenance'; end if;
  caught := false;
  begin
    update public.smea_indicator_definitions
      set definition_status = 'verified' where id = definition_one;
  exception when check_violation then
    caught := true;
  end;
  if not caught then raise exception 'Unverified formula marked verified'; end if;
end
$verify$;
rollback;
