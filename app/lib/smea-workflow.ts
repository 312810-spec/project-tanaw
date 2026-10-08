/**
 * Confirmed TANAW school workflow policy.
 * Pure decisions, not authentication or a database mutation endpoint.
 * Callers MUST load actors, assignments, versions and reviews from trusted
 * server storage, supply server time and persist allowed changes atomically.
 */
export type SchoolRole = "teacher" | "subjectCoordinator" | "smeaCoordinator" | "schoolHead" | "districtCoordinator";
export type ReviewStage = "subject" | "school" | "head";
export interface Actor {
  id: string;
  schoolId: string;
  active: boolean;
  roles: readonly SchoolRole[];
  subjectIds: readonly string[];
}
export interface ReviewTarget {
  id: string;
  schoolId: string;
  subjectId: string;
  authorId: string;
  version: number;
}
export interface DeadlineExtension {
  submissionId: string;
  until: number;
  reason: string;
  grantedBy: string;
}
export interface Submission extends ReviewTarget {
  deadlineAt: number;
  locked: boolean;
  extension: DeadlineExtension | null;
}
export interface VersionReview {
  targetId: string;
  version: number;
  stage: ReviewStage;
  reviewerId: string;
  selfReview: boolean;
}
export type PolicyIssue =
  | "offline" | "invalidIdentity" | "inactiveActor" | "wrongSchool"
  | "wrongRole" | "wrongSubject" | "selfReview" | "invalidVersion"
  | "invalidTime" | "deadlineClosed" | "lockedVersion"
  | "invalidExtension" | "validationErrors" | "missingReview"
  | "unacknowledgedMissing" | "alreadyLocked" | "districtNeedsLockedPacket"
  | "invalidAction" | "missingReturnReason";
export type PolicyResult = { allowed: true } | { allowed: false; issue: PolicyIssue };
const allow: PolicyResult = { allowed: true };
const deny = (issue: PolicyIssue): PolicyResult => ({ allowed: false, issue });
const nonblank = (value: string): boolean => typeof value === "string" && value.trim().length > 0;
const validTime = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;
const hasRole = (actor: Actor, role: SchoolRole): boolean => actor.roles.includes(role);

function actorScope(actor: Actor, schoolId: string, online: boolean): PolicyResult {
  if (!online) return deny("offline");
  if (!nonblank(actor.id) || !nonblank(actor.schoolId) || !nonblank(schoolId)) return deny("invalidIdentity");
  if (!actor.active) return deny("inactiveActor");
  if (actor.schoolId !== schoolId) return deny("wrongSchool");
  return allow;
}
function validTarget(target: ReviewTarget): boolean {
  return nonblank(target.id) && nonblank(target.schoolId) &&
    nonblank(target.subjectId) && nonblank(target.authorId) &&
    Number.isSafeInteger(target.version) && target.version > 0;
}

/** Exact cutoff: server time equal to deadline is already closed. */
export function checkSubmissionEdit(
  actor: Actor, submission: Submission, now: number, online: boolean,
): PolicyResult {
  const scope = actorScope(actor, submission.schoolId, online);
  if (!scope.allowed) return scope;
  if (!validTarget(submission)) return deny("invalidVersion");
  if (submission.locked) return deny("lockedVersion");
  // Teachers may edit their own assigned subject; coordinators may correct
  // within school. Neither grant follows from a browser-selected workspace.
  const coordinator = hasRole(actor, "smeaCoordinator");
  if (!coordinator && !(hasRole(actor, "teacher") && actor.id === submission.authorId)) return deny("wrongRole");
  if (!coordinator && !actor.subjectIds.includes(submission.subjectId)) return deny("wrongSubject");
  if (!validTime(now) || !validTime(submission.deadlineAt)) return deny("invalidTime");
  let cutoff = submission.deadlineAt;
  const extension = submission.extension;
  if (extension !== null) {
    if (extension.submissionId !== submission.id || !nonblank(extension.reason) ||
        !nonblank(extension.grantedBy) || !validTime(extension.until) ||
        extension.until <= submission.deadlineAt) return deny("invalidExtension");
    cutoff = extension.until;
  }
  return now < cutoff ? allow : deny("deadlineClosed");
}

/** Validate a coordinator-issued exception before storing it. */
export function checkExtensionGrant(
  actor: Actor, submission: Submission, until: number, reason: string,
  now: number, online: boolean,
): PolicyResult {
  const scope = actorScope(actor, submission.schoolId, online);
  if (!scope.allowed) return scope;
  if (!hasRole(actor, "smeaCoordinator")) return deny("wrongRole");
  if (!validTarget(submission)) return deny("invalidVersion");
  if (submission.locked) return deny("lockedVersion");
  if (!validTime(now) || !validTime(submission.deadlineAt) || !validTime(until)) return deny("invalidTime");
  if (!nonblank(reason) || until <= now || until <= submission.deadlineAt) return deny("invalidExtension");
  return allow;
}

/** Review stage identifies the role being exercised, even on multi-role accounts. */
export function checkReview(
  actor: Actor, target: ReviewTarget, stage: ReviewStage, online: boolean,
): PolicyResult {
  const scope = actorScope(actor, target.schoolId, online);
  if (!scope.allowed) return scope;
  if (!validTarget(target)) return deny("invalidVersion");
  const requiredRole = { subject: "subjectCoordinator", school: "smeaCoordinator", head: "schoolHead" } as const;
  if (!(stage in requiredRole)) return deny("invalidAction");
  if (!hasRole(actor, requiredRole[stage])) return deny("wrongRole");
  if (stage === "subject" && !actor.subjectIds.includes(target.subjectId)) return deny("wrongSubject");
  // Latest user override: only the SMEA review stage may self-review.
  // A coordinator who also holds School Head role still cannot self-approve.
  if (actor.id === target.authorId && stage !== "school") return deny("selfReview");
  return allow;
}

export function createVersionReview(
  actor: Actor, target: ReviewTarget, stage: ReviewStage, online: boolean,
): { decision: PolicyResult; review: VersionReview | null } {
  const decision = checkReview(actor, target, stage, online);
  return {
    decision,
    review: decision.allowed ? {
      targetId: target.id, version: target.version, stage,
      reviewerId: actor.id, selfReview: actor.id === target.authorId,
    } : null,
  };
}

export interface PacketLockInput {
  target: ReviewTarget;
  locked: boolean;
  validationErrors: number;
  missingSubmissions: readonly { submissionId: string; reason: string }[];
  schoolHeadAcknowledgedMissing: boolean;
  reviews: readonly VersionReview[];
}
export type LockResult =
  | { allowed: false; issue: PolicyIssue }
  | { allowed: true; completeness: "complete" | "incomplete" };

/**
 * Inputs must be produced by server validation, not request-body booleans.
 * Subject checking is a consolidation prerequisite checked per submission.
 * This packet-level gate checks the current school and head reviews.
 */
export function checkPacketLock(actor: Actor, packet: PacketLockInput, online: boolean): LockResult {
  const scope = actorScope(actor, packet.target.schoolId, online);
  if (!scope.allowed) return scope;
  if (!hasRole(actor, "smeaCoordinator")) return deny("wrongRole") as LockResult;
  if (!validTarget(packet.target)) return deny("invalidVersion") as LockResult;
  if (packet.locked) return deny("alreadyLocked") as LockResult;
  if (!Number.isSafeInteger(packet.validationErrors) || packet.validationErrors !== 0)
    return deny("validationErrors") as LockResult;
  const reviews = packet.reviews.filter((review) =>
    review.targetId === packet.target.id && review.version === packet.target.version &&
    nonblank(review.reviewerId) &&
    review.selfReview === (review.reviewerId === packet.target.authorId));
  if (!reviews.some((review) => review.stage === "school") ||
      !reviews.some((review) => review.stage === "head" && !review.selfReview))
    return deny("missingReview") as LockResult;
  const missingIds = new Set(packet.missingSubmissions.map((item) => item.submissionId));
  if (packet.missingSubmissions.length > 0 &&
      (!packet.schoolHeadAcknowledgedMissing ||
       missingIds.size !== packet.missingSubmissions.length ||
       packet.missingSubmissions.some((item) => !nonblank(item.submissionId) || !nonblank(item.reason))))
    return deny("unacknowledgedMissing") as LockResult;
  return { allowed: true, completeness: packet.missingSubmissions.length > 0 ? "incomplete" : "complete" };
}

export function checkDistrictReview(
  actor: Actor, schoolId: string, locked: boolean,
  action: "accept" | "return", reason: string, online: boolean,
): PolicyResult {
  const scope = actorScope(actor, schoolId, online);
  if (!scope.allowed) return scope;
  if (!hasRole(actor, "districtCoordinator")) return deny("wrongRole");
  if (!locked) return deny("districtNeedsLockedPacket");
  if (action !== "accept" && action !== "return") return deny("invalidAction");
  if (action === "return" && !nonblank(reason)) return deny("missingReturnReason");
  return allow;
}

/** New version identity invalidates old reviews; source objects stay unchanged. */
export function nextSubmissionVersion(
  actor: Actor, submission: Submission, now: number, online: boolean,
): { decision: PolicyResult; next: Submission | null } {
  const decision = checkSubmissionEdit(actor, submission, now, online);
  if (!decision.allowed) return { decision, next: null };
  if (!Number.isSafeInteger(submission.version + 1)) return { decision: deny("invalidVersion"), next: null };
  return { decision, next: { ...submission, version: submission.version + 1 } };
}
