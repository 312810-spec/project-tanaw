-- Decision 22: SMEA may transparently review their OWN submission version.
-- Existing school/Head packet review, Lock, RLS and immutable history stay intact.
alter table public.tanaw_submission_reviews
 drop constraint tanaw_submission_reviews_self_review_check;

create or replace function public.tanaw_review_submission(target_submission uuid,expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare s public.tanaw_submission_slots; c public.tanaw_reporting_cycles;
 v public.tanaw_submissions; own_exception boolean;
begin
 select sl.* into s from public.tanaw_submission_slots sl
  join public.tanaw_submissions sub on sub.slot_id=sl.id where sub.id=target_submission;
 select * into c from public.tanaw_reporting_cycles where id=s.cycle_id for update;
 if not found then raise exception 'Assigned submission reviewer required' using errcode='42501'; end if;
 own_exception := s.author_id=auth.uid()
  and tanaw_private.has_school_role(c.school_id,array['smeaCoordinator']);
 if not coalesce(own_exception,false) and not (
  s.author_id is distinct from auth.uid() and exists(select 1 from public.tanaw_memberships m
   where m.school_id=c.school_id and m.user_id=auth.uid() and m.active
    and 'subjectCoordinator'=any(m.roles) and s.subject_id=any(m.subject_ids))) then
  raise exception 'Assigned subject reviewer or own-submission SMEA Coordinator required' using errcode='42501';
 end if;
 select * into v from public.tanaw_submissions where id=target_submission;
 if c.locked_at is not null and tanaw_private.open_amendment(c.id) is null then
  raise exception 'Locked cycle' using errcode='42501'; end if;
 if expected_version is null or v.current_version=0 or expected_version<>v.current_version then
  raise exception 'Current submitted version required' using errcode='40001'; end if;
 if exists(select 1 from public.tanaw_submission_reviews where submission_id=v.id
  and version=v.current_version and stage='subject') then return; end if;
 insert into public.tanaw_submission_reviews(submission_id,version,stage,reviewer_id,self_review)
  values(v.id,v.current_version,'subject',auth.uid(),own_exception);
 insert into public.tanaw_workflow_events(school_id,cycle_id,actor_id,action,target_id,reason)
  values(c.school_id,c.id,auth.uid(),'subjectReview',v.id,
   case when own_exception then 'SMEA Coordinator own-submission self-review recorded'
    else 'Subject review recorded' end);
end; $$;
revoke all on function public.tanaw_review_submission(uuid,integer) from public,anon,authenticated;
grant execute on function public.tanaw_review_submission(uuid,integer) to authenticated;
-- Clients still have SELECT only on review rows. Self-review attribution comes
-- from trusted membership and author identity, never from a client flag.
