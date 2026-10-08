import assert from "node:assert/strict";
import test from "node:test";
import { checkSubmissionEdit, checkExtensionGrant, checkReview, createVersionReview,
  checkPacketLock, checkDistrictReview, nextSubmissionVersion } from "../app/lib/smea-workflow.ts";

const actor = (roles = ["teacher"], overrides = {}) => ({
  id: "teacher-1", schoolId: "synthetic-school", active: true, roles,
  subjectIds: ["synthetic-subject"], ...overrides,
});
const coordinator = actor(["smeaCoordinator"], { id: "coordinator" });
const submission = {
  id: "synthetic-submission", schoolId: "synthetic-school",
  subjectId: "synthetic-subject", authorId: "teacher-1",
  version: 1, deadlineAt: 1000, locked: false, extension: null,
};
const denial = (result, issue) => assert.deepEqual(result, { allowed: false, issue });
const reviewedPacket = (overrides = {}) => ({
  target: submission, locked: false, validationErrors: 0,
  missingSubmissions: [], schoolHeadAcknowledgedMissing: false,
  reviews: [
    { targetId: submission.id, version: 1, stage: "school", reviewerId: "coordinator", selfReview: false },
    { targetId: submission.id, version: 1, stage: "head", reviewerId: "head", selfReview: false },
  ], ...overrides,
});

test("deadline closes at the exact server cutoff, without creating Lock", () => {
  assert.deepEqual(checkSubmissionEdit(actor(), submission, 999, true), { allowed: true });
  denial(checkSubmissionEdit(actor(), submission, 1000, true), "deadlineClosed");
  assert.equal(submission.locked, false);
});
test("own submission still needs an active assignment", () => {
  denial(checkSubmissionEdit(actor([], {}), submission, 999, true), "wrongRole");
  denial(checkSubmissionEdit(actor(["teacher"], { subjectIds: [] }), submission, 999, true), "wrongSubject");
  denial(checkSubmissionEdit(actor(["teacher"], { id: "other" }), submission, 999, true), "wrongRole");
});
test("cross-school, disabled and offline changes fail closed", () => {
  denial(checkSubmissionEdit(actor(["teacher"], { schoolId: "other" }), submission, 999, true), "wrongSchool");
  denial(checkSubmissionEdit(actor(["teacher"], { active: false }), submission, 999, true), "inactiveActor");
  denial(checkSubmissionEdit(actor(), submission, 999, false), "offline");
});
test("invalid time and identity cannot reopen editing", () => {
  for (const now of [NaN, Infinity, -1, 1.5]) denial(checkSubmissionEdit(actor(), submission, now, true), "invalidTime");
  denial(checkSubmissionEdit(actor(["teacher"], { id: "" }), submission, 999, true), "invalidIdentity");
});
test("extension is specific, reasoned, time limited and cannot bypass Lock", () => {
  const extended = { ...submission, extension: { submissionId: submission.id, until: 2000, reason: "Synthetic reason", grantedBy: coordinator.id } };
  assert.equal(checkSubmissionEdit(actor(), extended, 1500, true).allowed, true);
  denial(checkSubmissionEdit(actor(), extended, 2000, true), "deadlineClosed");
  denial(checkSubmissionEdit(actor(), { ...extended, locked: true }, 1500, true), "lockedVersion");
  denial(checkSubmissionEdit(actor(), { ...extended, extension: { ...extended.extension, submissionId: "other" } }, 1500, true), "invalidExtension");
});
test("only coordinator grants a future extension with a reason", () => {
  assert.equal(checkExtensionGrant(coordinator, submission, 2000, "Reason", 1000, true).allowed, true);
  denial(checkExtensionGrant(actor(), submission, 2000, "Reason", 1000, true), "wrongRole");
  denial(checkExtensionGrant(coordinator, submission, 2000, " ", 1000, true), "invalidExtension");
  denial(checkExtensionGrant(coordinator, submission, 1000, "Reason", 1000, true), "invalidExtension");
  denial(checkExtensionGrant(coordinator, { ...submission, locked: true }, 2000, "Reason", 1000, true), "lockedVersion");
});
test("subject review is assignment scoped and cannot self-review", () => {
  const reviewer = actor(["subjectCoordinator"], { id: "reviewer" });
  assert.equal(checkReview(reviewer, submission, "subject", true).allowed, true);
  denial(checkReview({ ...reviewer, subjectIds: [] }, submission, "subject", true), "wrongSubject");
  denial(checkReview(actor(["subjectCoordinator"]), submission, "subject", true), "selfReview");
});
test("coordinator self-review is explicitly recorded", () => {
  const own = { ...submission, authorId: coordinator.id };
  const result = createVersionReview(coordinator, own, "school", true);
  assert.equal(result.decision.allowed, true);
  assert.equal(result.review.selfReview, true);
  assert.equal(result.review.reviewerId, coordinator.id);
});
test("multi-role coordinator cannot self-approve as School Head", () => {
  const both = { ...coordinator, roles: ["smeaCoordinator", "schoolHead"] };
  denial(checkReview(both, { ...submission, authorId: coordinator.id }, "head", true), "selfReview");
  denial(checkReview(actor(["teacher"]), submission, "school", true), "wrongRole");
});
test("lock needs current-version school and independent head reviews", () => {
  assert.deepEqual(checkPacketLock(coordinator, reviewedPacket(), true), { allowed: true, completeness: "complete" });
  denial(checkPacketLock(coordinator, reviewedPacket({ reviews: [] }), true), "missingReview");
  const stale = reviewedPacket(); stale.target = { ...submission, version: 2 };
  denial(checkPacketLock(coordinator, stale, true), "missingReview");
  denial(checkPacketLock(coordinator, reviewedPacket({ validationErrors: 1 }), true), "validationErrors");
});
test("only active school coordinator can Lock, online, once", () => {
  denial(checkPacketLock(actor(["schoolHead"]), reviewedPacket(), true), "wrongRole");
  denial(checkPacketLock({ ...coordinator, schoolId: "other" }, reviewedPacket(), true), "wrongSchool");
  denial(checkPacketLock({ ...coordinator, active: false }, reviewedPacket(), true), "inactiveActor");
  denial(checkPacketLock(coordinator, reviewedPacket(), false), "offline");
  denial(checkPacketLock(coordinator, reviewedPacket({ locked: true }), true), "alreadyLocked");
});
test("incomplete Lock needs per-submission reasons and head acknowledgment", () => {
  const missing = [{ submissionId: "missing-1", reason: "Awaiting source" }];
  denial(checkPacketLock(coordinator, reviewedPacket({ missingSubmissions: missing }), true), "unacknowledgedMissing");
  assert.deepEqual(checkPacketLock(coordinator, reviewedPacket({ missingSubmissions: missing, schoolHeadAcknowledgedMissing: true }), true),
    { allowed: true, completeness: "incomplete" });
  denial(checkPacketLock(coordinator, reviewedPacket({ missingSubmissions: [{ submissionId: "m", reason: "" }], schoolHeadAcknowledgedMissing: true }), true), "unacknowledgedMissing");
});
test("recorded coordinator self-review does not replace independent head review", () => {
  const packet = reviewedPacket();
  packet.target = { ...submission, authorId: coordinator.id };
  packet.reviews = [
    { targetId: submission.id, version: 1, stage: "school", reviewerId: coordinator.id, selfReview: true },
    { targetId: submission.id, version: 1, stage: "head", reviewerId: coordinator.id, selfReview: true },
  ];
  denial(checkPacketLock(coordinator, packet, true), "missingReview");
  packet.reviews[1] = { ...packet.reviews[1], reviewerId: "head", selfReview: false };
  assert.equal(checkPacketLock(coordinator, packet, true).allowed, true);
});
test("district acts on locked aggregates only; returns require comments", () => {
  const district = actor(["districtCoordinator"], { id: "district" });
  assert.equal(checkDistrictReview(district, submission.schoolId, true, "accept", "", true).allowed, true);
  denial(checkDistrictReview(district, submission.schoolId, false, "accept", "", true), "districtNeedsLockedPacket");
  denial(checkDistrictReview(district, submission.schoolId, true, "return", " ", true), "missingReturnReason");
  denial(checkDistrictReview(district, submission.schoolId, true, "unlock", "Reason", true), "invalidAction");
  denial(checkSubmissionEdit(district, submission, 999, true), "wrongRole");
});
test("correction preserves the old version and cannot reuse its reviews", () => {
  const snapshot = structuredClone(submission);
  const result = nextSubmissionVersion(actor(), submission, 999, true);
  assert.equal(result.next.version, 2);
  assert.deepEqual(submission, snapshot);
  denial(checkPacketLock(coordinator, reviewedPacket({ target: result.next }), true), "missingReview");
  denial(nextSubmissionVersion(actor(), { ...submission, locked: true }, 999, true).decision, "lockedVersion");
});
