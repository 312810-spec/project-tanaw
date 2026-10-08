-- TANAW school-scoped SMEA indicator registry, local-first foundation.
-- No official formula, indicator, school, user, or approval data is seeded.
-- RLS is deliberately fail-closed until authenticated membership/role tables
-- and governance transition rules have been implemented and verified.
create table public.smea_indicator_definitions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  indicator_code text not null,
  label text not null,
  unit text not null,
  school_year text not null,
  reporting_period text not null,
  definition_status text not null default 'pending'
    check (definition_status in ('pending', 'verified', 'superseded')),
  source_id text not null,
  source_title text not null,
  source_locator text not null,
  source_revision text,
  formula_expression text,
  numerator_definition text,
  denominator_definition text,
  rounding_rule text,
  created_at timestamptz not null default now(),
  constraint smea_indicator_code_not_blank check (length(btrim(indicator_code)) > 0),
  constraint smea_indicator_source_not_blank check (length(btrim(source_id)) > 0 and length(btrim(source_locator)) > 0),
  constraint smea_indicator_formula_complete check (
    (formula_expression is null and numerator_definition is null
      and denominator_definition is null and rounding_rule is null)
    or (formula_expression is not null and numerator_definition is not null
      and denominator_definition is not null and rounding_rule is not null)
  ),
  constraint smea_indicator_verified_formula check (
    definition_status <> 'verified' or formula_expression is not null
  ),
  unique (school_id, indicator_code, school_year, reporting_period),
  unique (id, school_id)
);

create table public.smea_indicator_evidence (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  definition_id uuid not null,
  scope_id text not null,
  evidence_state text not null default 'missing'
    check (evidence_state in ('missing', 'recorded', 'rejected')),
  number_value numeric,
  text_value text,
  missing_reason text,
  source_id text,
  source_title text,
  source_locator text,
  source_revision text,
  created_at timestamptz not null default now(),
  constraint smea_evidence_same_school foreign key (definition_id, school_id)
    references public.smea_indicator_definitions (id, school_id) on delete restrict,
  constraint smea_evidence_shape check (
    (evidence_state = 'missing'
      and number_value is null and text_value is null
      and nullif(btrim(missing_reason), '') is not null
      and source_id is null and source_title is null and source_locator is null)
    or
    (evidence_state = 'recorded'
      and missing_reason is null
      and ((number_value is not null and text_value is null)
        or (number_value is null and text_value is not null))
      and nullif(btrim(source_id), '') is not null
      and nullif(btrim(source_title), '') is not null
      and nullif(btrim(source_locator), '') is not null)
    or
    (evidence_state = 'rejected'
      and number_value is null and text_value is null
      and nullif(btrim(missing_reason), '') is not null)
  )
);

create index smea_indicator_evidence_by_definition
  on public.smea_indicator_evidence (school_id, definition_id, created_at desc);

alter table public.smea_indicator_definitions enable row level security;
alter table public.smea_indicator_evidence enable row level security;

-- No policies and no client grants are issued here. Authenticated access
-- intentionally remains unavailable, including to school coordinators.
-- Implement membership-derived permissions and actor-attributed auditing
-- in a separate reviewed migration after governance is reconciled.
revoke all on public.smea_indicator_definitions from anon, authenticated;
revoke all on public.smea_indicator_evidence from anon, authenticated;
