type Submission = { id: string; current_version: number; extension_until: string | null };
type Review = { submission_id: string; version: number };
export function workflowReminders(deadline: string, locked: boolean, submissions: Submission[], reviews: Review[], now: number) {
  const cutoff = Date.parse(deadline);
  const validClock = Number.isFinite(now) && Number.isFinite(cutoff);
  return {
    deadline: locked ? "School packet locked" : !validClock ? "Deadline status unavailable" : now >= cutoff ? "Submission deadline closed" : cutoff - now <= 48 * 60 * 60 * 1000 ? "Submission deadline within 48 hours" : "Submission deadline upcoming",
    missing: submissions.filter((submission) => submission.current_version === 0).length,
    awaitingSubjectReview: submissions.filter((submission) => submission.current_version > 0 && !reviews.some((review) => review.submission_id === submission.id && review.version === submission.current_version)).length,
    activeExtensions: validClock && !locked ? submissions.filter((submission) => submission.extension_until && Date.parse(submission.extension_until) > now).length : 0,
  };
}
