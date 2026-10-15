-- Source declarations only. No approved/active roster or import authority is created.
create function tanaw_private.valid_roster_declaration(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare field text; maximum integer;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>262144 then return false; end if;
 if (select count(*) from jsonb_object_keys(p))<>9 or exists(
  select 1 from jsonb_object_keys(p) k where k not in
  ('schema','sourceTitle','sourceLocator','sourceRevision','classReference','schoolYear','term','sourceHash','learnerKeys')) then return false; end if;
 foreach field in array array['schema','sourceTitle','sourceLocator','sourceRevision','classReference','schoolYear','term','sourceHash'] loop
  maximum := case field when 'sourceLocator' then 1000 when 'schoolYear' then 100 else 200 end;
  if jsonb_typeof(p->field) is distinct from 'string' or char_length(p->>field) not between 1 and maximum
    or btrim(p->>field)<>p->>field or (p->>field) ~ '[[:cntrl:]]' then return false; end if;
 end loop;
 if p->>'schema'<>'tanaw-roster-declaration-v1' or p->>'term' not in ('TERM 1','TERM 2','TERM 3')
  or (p->>'sourceHash') !~ '^[a-f0-9]{64}$' then return false; end if;
 if jsonb_typeof(p->'learnerKeys') is distinct from 'array' then return false; end if;
 if jsonb_array_length(p->'learnerKeys') not between 1 and 1000 then return false; end if;
 if exists(select 1 from jsonb_array_elements(p->'learnerKeys') e(value)
  where jsonb_typeof(value) is distinct from 'string' or char_length(value#>>'{}') not between 1 and 200
   or btrim(value#>>'{}')<>value#>>'{}' or (value#>>'{}') ~ '[[:cntrl:]]') then return false; end if;
 if (select count(distinct value#>>'{}') from jsonb_array_elements(p->'learnerKeys') e(value))<>jsonb_array_length(p->'learnerKeys') then return false; end if;
 return true;
end $$;
revoke all on function tanaw_private.valid_roster_declaration(jsonb) from public,anon,authenticated;

create table public.tanaw_roster_declarations (
 id uuid primary key default gen_random_uuid(),
 slot_id uuid not null references public.tanaw_submission_slots(id) on delete restrict,
 revision integer not null check(revision>0),
 request_id uuid not null,
 payload jsonb not null check(tanaw_private.valid_roster_declaration(payload)),
 state text not null default 'pending' check(state='pending'),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(slot_id,revision), unique(created_by,request_id)
);
alter table public.tanaw_roster_declarations enable row level security;
revoke all on public.tanaw_roster_declarations from public,anon,authenticated;
grant select on public.tanaw_roster_declarations to authenticated;
create policy roster_declaration_read on public.tanaw_roster_declarations for select to authenticated
 using(tanaw_private.can_read_slot(slot_id));

create function tanaw_private.keep_roster_declaration() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'Roster declarations are immutable' using errcode='42501'; end $$;
revoke all on function tanaw_private.keep_roster_declaration() from public,anon,authenticated;
create trigger roster_declaration_immutable before update or delete on public.tanaw_roster_declarations
 for each row execute function tanaw_private.keep_roster_declaration();

create function public.tanaw_declare_roster_source(
 target_submission uuid, expected_revision integer, request_id uuid, source jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare slot public.tanaw_submission_slots; prior public.tanaw_roster_declarations;
 latest integer; year_label text; result_id uuid;
begin
 select s.* into slot from public.tanaw_submission_slots s join public.tanaw_submissions v on v.slot_id=s.id
  where v.id=target_submission for update of s;
 if not found or not tanaw_private.has_school_role(slot.school_id,array['smeaCoordinator']) then
  raise exception 'School coordinator required' using errcode='42501'; end if;
 if request_id is null or not tanaw_private.valid_roster_declaration(source) then
  raise exception 'Valid roster source declaration required' using errcode='22023'; end if;
 select b.school_year into year_label from public.tanaw_reporting_cycles c
  join public.tanaw_instructional_blocks b on b.id=c.instructional_block_id where c.id=slot.cycle_id;
 if source->>'schoolYear' is distinct from year_label then
  raise exception 'Source school year does not match assignment' using errcode='22023'; end if;
 select d.* into prior from public.tanaw_roster_declarations d
  where d.created_by=auth.uid() and d.request_id=tanaw_declare_roster_source.request_id;
 if found then
  if prior.slot_id<>slot.id or prior.payload<>source then
   raise exception 'Request already used for a different declaration' using errcode='22023'; end if;
  return prior.id;
 end if;
 select coalesce(max(d.revision),0) into latest from public.tanaw_roster_declarations d where d.slot_id=slot.id;
 if expected_revision is null or expected_revision<>latest then
  raise exception 'Roster source revision changed; refresh before retrying' using errcode='40001'; end if;
 begin
  insert into public.tanaw_roster_declarations(slot_id,revision,request_id,payload,created_by)
   values(slot.id,latest+1,request_id,source,auth.uid()) returning id into result_id;
 exception when unique_violation then
  raise exception 'Roster declaration request conflicts; refresh before retrying' using errcode='22023';
 end;
 return result_id;
end $$;
revoke all on function public.tanaw_declare_roster_source(uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.tanaw_declare_roster_source(uuid,integer,uuid,jsonb) to authenticated;
