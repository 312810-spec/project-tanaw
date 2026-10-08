-- Handover of an unsubmitted assignment. Submitted versions are never rewritten.
create table public.tanaw_submission_handovers (
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null references public.tanaw_submissions(id) on delete restrict,
 school_id uuid not null references public.tanaw_schools(id) on delete restrict,
 previous_author uuid not null references auth.users(id) on delete restrict,
 next_author uuid not null references auth.users(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 reason text not null check(nullif(btrim(reason),'') is not null),
 occurred_at timestamptz not null default now(),
 check(previous_author<>next_author)
);
alter table public.tanaw_submission_handovers enable row level security;
revoke all on public.tanaw_submission_handovers from anon,authenticated;
grant select on public.tanaw_submission_handovers to authenticated;
create policy tanaw_handover_read on public.tanaw_submission_handovers for select to authenticated
 using(tanaw_private.has_school_role(school_id,array['smeaCoordinator','schoolHead']));

create function public.tanaw_handover_unsubmitted(target_submission uuid,target_author uuid,expected_author uuid,change_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare s public.tanaw_submission_slots; c public.tanaw_reporting_cycles; v public.tanaw_submissions;
begin
 select sl.* into s from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id where sub.id=target_submission;
 select * into c from public.tanaw_reporting_cycles where id=s.cycle_id for update;
 if not found or not tanaw_private.has_school_role(c.school_id,array['smeaCoordinator']) then raise exception 'Coordinator required' using errcode='42501'; end if;
 -- Refresh after the cycle lock: an intervening handover must not be overwritten.
 select sl.* into s from public.tanaw_submission_slots sl join public.tanaw_submissions sub on sub.slot_id=sl.id where sub.id=target_submission;
 select * into v from public.tanaw_submissions where id=target_submission for update;
 if c.locked_at is not null or v.current_version<>0 then raise exception 'Only an unlocked unsubmitted assignment may be handed over' using errcode='42501'; end if;
 if expected_author is null or expected_author<>s.author_id then raise exception 'Assignment changed; refresh before retrying' using errcode='40001'; end if;
 if target_author is null or target_author=s.author_id or nullif(btrim(change_reason),'') is null or length(change_reason)>2000 then raise exception 'New assignee and handover reason required' using errcode='22023'; end if;
 if not exists(select 1 from public.tanaw_memberships m where m.school_id=c.school_id and m.user_id=target_author and m.active and (m.roles && array['smeaCoordinator'] or ('teacher'=any(m.roles) and s.subject_id=any(m.subject_ids)))) then raise exception 'Active assigned subject author required' using errcode='22023'; end if;
 update public.tanaw_submission_slots set author_id=target_author where id=s.id;
 insert into public.tanaw_submission_handovers(submission_id,school_id,previous_author,next_author,actor_id,reason) values(v.id,c.school_id,s.author_id,target_author,auth.uid(),change_reason);
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason) values(c.school_id,c.id,auth.uid(),'handoverUnsubmitted',v.id,change_reason);
 -- No deadline or extension is changed. Existing device drafts stay with their original account.
end; $$;
revoke all on function public.tanaw_handover_unsubmitted(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.tanaw_handover_unsubmitted(uuid,uuid,uuid,text) to authenticated;
