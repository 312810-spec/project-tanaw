-- Revision checked access changes; old client writes are intentionally denied.
alter table public.tanaw_memberships add column revision bigint not null default 0 check (revision >= 0);
revoke execute on function public.tanaw_manage_member(uuid,uuid,text[],text[],boolean,text) from authenticated;

create function public.tanaw_manage_member(
  target_school uuid, target_user uuid, new_roles text[],
  new_subject_ids text[], is_active boolean, change_reason text, expected_revision bigint
) returns void language plpgsql security definer set search_path = ''
as $$
declare previous jsonb; resulting jsonb; actual_revision bigint;
begin
  if not tanaw_private.has_school_role(target_school, array['smeaCoordinator']) then
    raise exception 'Coordinator membership required' using errcode = '42501';
  end if;
  if target_user = auth.uid() then
    raise exception 'Self-assignment is not allowed' using errcode = '42501';
  end if;
  if target_user is null or new_roles is null or cardinality(new_roles) = 0
      or array_position(new_roles, null) is not null
      or not (new_roles <@ array['teacher','subjectCoordinator','smeaCoordinator','schoolHead','districtCoordinator']::text[])
      or new_subject_ids is null or array_position(new_subject_ids, null) is not null
      or exists(select 1 from unnest(new_subject_ids) s where nullif(btrim(s), '') is null)
      or is_active is null or nullif(btrim(change_reason), '') is null then
    raise exception 'Invalid membership change' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_school::text || ':' || target_user::text, 0));
  select m.revision into actual_revision from public.tanaw_memberships m
    where m.school_id = target_school and m.user_id = target_user for update;
  if expected_revision is null or expected_revision <> coalesce(actual_revision, 0) then
    raise exception 'Membership changed; reload access before retrying' using errcode = '40001';
  end if;
  select to_jsonb(m) into previous from public.tanaw_memberships m
    where m.school_id = target_school and m.user_id = target_user for update;
  insert into public.tanaw_memberships (school_id, user_id, roles, subject_ids, active, revision)
    values (target_school, target_user, new_roles, new_subject_ids, is_active, 1)
    on conflict (school_id, user_id) do update
      set roles = excluded.roles, subject_ids = excluded.subject_ids,
          active = excluded.active, updated_at = now(), revision = public.tanaw_memberships.revision + 1;
  select to_jsonb(m) into resulting from public.tanaw_memberships m
    where m.school_id = target_school and m.user_id = target_user;
  insert into public.tanaw_membership_events
    (school_id, target_user_id, actor_id, reason, before_value, after_value)
    values (target_school, target_user, auth.uid(), change_reason, previous, resulting);
end;
$$;
revoke all on function public.tanaw_manage_member(uuid,uuid,text[],text[],boolean,text,bigint) from public, anon, authenticated;
grant execute on function public.tanaw_manage_member(uuid,uuid,text[],text[],boolean,text,bigint) to authenticated;

-- School-scoped email labels, never an unrestricted auth directory.
create function public.tanaw_member_directory(target_school uuid)
returns table(user_id uuid,email text,roles text[],subject_ids text[],active boolean,revision bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not tanaw_private.has_school_role(target_school,array['smeaCoordinator']) then
   raise exception 'Coordinator membership required' using errcode='42501';
 end if;
 return query select m.user_id,u.email::text,m.roles,m.subject_ids,m.active,m.revision
   from public.tanaw_memberships m join auth.users u on u.id=m.user_id
   where m.school_id=target_school order by u.email,m.user_id;
end;
$$;
revoke all on function public.tanaw_member_directory(uuid) from public,anon,authenticated;
grant execute on function public.tanaw_member_directory(uuid) to authenticated;
