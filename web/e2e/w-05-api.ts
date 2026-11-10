import type { Page, Route } from "@playwright/test";
import type { Schemas } from "@wolbachia/api-client";
import { makeMe } from "../src/test/fake-api";
import { mockApi } from "./fixtures/mock-api";

export const SUBJECT_ID = "14800000-0000-4000-8000-000000000001";
export const CENTER_ID = "14800000-0000-4000-8000-000000000002";
export const TRAINING_ID = "14800000-0000-4000-8000-000000000003";
export const TRAINING_VERSION_ID = "14800000-0000-4000-8000-000000000004";
export const EVIDENCE_ID = "14800000-0000-4000-8000-000000000005";
export const RUBRIC_ID = "14800000-0000-4000-8000-000000000006";
export const OLD_RUBRIC_VERSION = "14800000-0000-4000-8000-000000000007";
export const RUBRIC_VERSION = "14800000-0000-4000-8000-000000000008";
export const OLD_EVALUATION_ID = "14800000-0000-4000-8000-000000000009";
export const NEW_EVALUATION_ID = "14800000-0000-4000-8000-000000000010";
const CERTIFICATE_ID = "14800000-0000-4000-8000-000000000011";
const OLD_ATTEMPT_ID = "14800000-0000-4000-8000-000000000012";
const ATTEMPT_ID = "14800000-0000-4000-8000-000000000013";
export const CLOCK = "2026-11-09T18:00:00Z";
export const EXPIRY = "2027-11-09T18:00:00Z";
export const RUBRIC_CODE = "FIELD-148";
export const TRAINING_CODE = "COURSE-148";

const pageOf = <T>(results: T[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});
const training: Schemas["TrainingRead"] = {
  id: TRAINING_ID,
  code: TRAINING_CODE,
  name: "Synthetic field safety",
  revision: 1,
  current_version_id: TRAINING_VERSION_ID,
};
const trainingVersion: Schemas["TrainingVersionRead"] = {
  id: TRAINING_VERSION_ID,
  training_id: TRAINING_ID,
  version: 1,
  validity_seconds: 31536000,
  enabled_actions: ["release.record"],
  effective_from: "2026-01-01T00:00:00Z",
  is_active: true,
  created_at: CLOCK,
};
const rubric: Schemas["RubricRead"] = {
  id: RUBRIC_ID,
  code: RUBRIC_CODE,
  name: "Synthetic field observation",
  revision: 2,
  current_version_id: RUBRIC_VERSION,
};
const rubricVersion: Schemas["RubricVersionRead"] = {
  id: RUBRIC_VERSION,
  rubric_id: RUBRIC_ID,
  version: 2,
  weights: { presentation: 20, execution: 50, coverage: 30 },
  pass_threshold: "80.0000",
  critical_checks: ["safety"],
  effective_from: "2026-11-01T00:00:00Z",
  created_at: CLOCK,
};
const oldRubric: Schemas["RubricVersionRead"] = {
  ...rubricVersion,
  id: OLD_RUBRIC_VERSION,
  version: 1,
  weights: { presentation: 10, execution: 70, coverage: 20 },
  effective_from: "2026-01-01T00:00:00Z",
};
const oldAttempt: Schemas["EvaluationAttemptRead"] = {
  id: OLD_ATTEMPT_ID,
  evaluation_id: OLD_EVALUATION_ID,
  predecessor_id: null,
  revision: 1,
  observed_at: "2026-10-20T18:00:00Z",
  section_scores: { presentation: "90", execution: "60", coverage: "50" },
  critical_responses: { safety: true },
  score: "61.0000",
  outcome: "low",
  created_at: "2026-10-20T18:00:00Z",
  created_by: SUBJECT_ID,
  completion_sequence: 1,
};
const correctedAttempt: Schemas["EvaluationAttemptRead"] = {
  ...oldAttempt,
  id: ATTEMPT_ID,
  predecessor_id: OLD_ATTEMPT_ID,
  revision: 2,
  section_scores: { presentation: "90", execution: "65", coverage: "50" },
  score: "64.5000",
  reason_code: "correction",
  reason: "Synthetic retained correction reason",
  created_at: "2026-10-21T18:00:00Z",
  completion_sequence: 2,
};
const oldEvaluation: Schemas["EvaluationRead"] = {
  id: OLD_EVALUATION_ID,
  subject_id: SUBJECT_ID,
  rubric_version_id: OLD_RUBRIC_VERSION,
  center_id: CENTER_ID,
  quadrant_id: null,
  created_at: "2026-10-20T18:00:00Z",
  revision: 2,
  is_voided: false,
  current: correctedAttempt,
  void: null,
};
const JOURNEY_ME = makeMe({
  permissions: [
    "training.read",
    "training.manage",
    "field.upload",
    "evaluation.create",
    "evaluation.read",
  ],
  scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
});

interface JourneyState {
  commands: { path: string; body: unknown }[];
  certificates: Schemas["CertificationSummary"][];
  evaluations: Schemas["EvaluationRead"][];
}
function record(route: Route, state: JourneyState) {
  const path = new URL(route.request().url()).pathname;
  const body: unknown = route.request().postDataJSON();
  state.commands.push({ path, body });
  return { path, body };
}
function receipt(command: string, id: string): Schemas["PeopleReceipt"] {
  return { command_id: command, id, revision: 1, recorded_at: CLOCK, evaluation: null };
}
function replyTraining(route: Route) {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith("/versions/"))
    return route.fulfill({ json: pageOf([trainingVersion]) });
  const code = url.searchParams.get("code");
  return route.fulfill({ json: pageOf(!code || code === TRAINING_CODE ? [training] : []) });
}
function replyRubric(route: Route) {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith("/versions/"))
    return route.fulfill({ json: pageOf([oldRubric, rubricVersion]) });
  return route.fulfill({
    json: pageOf(url.searchParams.get("code") === RUBRIC_CODE ? [rubric] : []),
  });
}
function replyCertification(route: Route, state: JourneyState) {
  if (route.request().method() === "GET")
    return route.fulfill({ json: pageOf(state.certificates) });
  const command = record(route, state).body as Schemas["CertificationWriteRequest"];
  state.certificates.push({
    id: CERTIFICATE_ID,
    subject_id: SUBJECT_ID,
    training_version_id: command.training_version,
    center_id: command.center,
    quadrant_id: command.quadrant ?? null,
    valid_from: command.valid_from,
    valid_to: command.valid_to,
    created_at: CLOCK,
    revision: 1,
    revoked_from: null,
  });
  return route.fulfill({ status: 201, json: receipt(command.command_id, CERTIFICATE_ID) });
}
function replyEligibility(route: Route, state: JourneyState) {
  const query = new URL(route.request().url()).searchParams;
  const result: Schemas["EligibilityRead"] = {
    subject_id: SUBJECT_ID,
    action: query.get("action") ?? "release.record",
    center_id: CENTER_ID,
    quadrant_id: null,
    training_eligible: state.certificates.length > 0,
    requirement_version_id: TRAINING_ID,
    certification_ids: state.certificates.map((certificate) => certificate.id),
    training_version_ids: [TRAINING_VERSION_ID],
    revocation_ids: [],
    valid_from: state.certificates.length ? CLOCK : null,
    valid_until: state.certificates.length ? EXPIRY : null,
    next_change_at: state.certificates.length ? EXPIRY : null,
    blockers: state.certificates.length ? [] : ["training_expired"],
    query_kind: "current",
  };
  return route.fulfill({ json: result });
}
function replyEvaluation(route: Route, state: JourneyState) {
  const path = new URL(route.request().url()).pathname;
  if (path.endsWith("/attempts/"))
    return route.fulfill({ json: pageOf([oldAttempt, correctedAttempt]) });
  if (route.request().method() === "GET") return route.fulfill({ json: pageOf(state.evaluations) });
  const command = record(route, state).body as Schemas["EvaluationCreateRequest"];
  const result: Schemas["EvaluationResult"] = {
    attempt_id: ATTEMPT_ID,
    rubric_version_id: command.rubric_version,
    outcome: "low",
    score: "62.0000",
    completion_sequence: 3,
  };
  const attempt = newAttempt(command, result);
  state.evaluations.unshift({
    ...oldEvaluation,
    id: NEW_EVALUATION_ID,
    rubric_version_id: command.rubric_version,
    revision: 1,
    created_at: CLOCK,
    current: attempt,
  });
  return route.fulfill({
    status: 201,
    json: { ...receipt(command.command_id, NEW_EVALUATION_ID), evaluation: result },
  });
}
function newAttempt(
  command: Schemas["EvaluationCreateRequest"],
  result: Schemas["EvaluationResult"],
): Schemas["EvaluationAttemptRead"] {
  return {
    ...oldAttempt,
    id: ATTEMPT_ID,
    evaluation_id: NEW_EVALUATION_ID,
    revision: 1,
    observed_at: command.observed_at,
    section_scores: command.section_scores,
    critical_responses: command.critical_responses,
    score: result.score,
    completion_sequence: result.completion_sequence,
    created_at: CLOCK,
  };
}

/** Synthetic B03 wiring; a saved command is never represented as an HR delivery receipt. */
export async function mockPeopleJourney(page: Page) {
  const state: JourneyState = { commands: [], certificates: [], evaluations: [oldEvaluation] };
  await mockApi(page, { me: JOURNEY_ME });
  await page.route("**/api/v1/trainings/**", replyTraining);
  await page.route("**/api/v1/evaluation-rubrics/**", replyRubric);
  await page.route("**/api/v1/evaluation-notice-policy/**", (route) =>
    route.fulfill({ json: pageOf([]) }),
  );
  await page.route("**/api/v1/training-requirements/**", (route) =>
    route.fulfill({ json: pageOf([]) }),
  );
  await page.route(`**/api/v1/users/${SUBJECT_ID}/trainings/**`, (route) =>
    replyCertification(route, state),
  );
  await page.route(`**/api/v1/users/${SUBJECT_ID}/eligibility/**`, (route) =>
    replyEligibility(route, state),
  );
  await page.route("**/api/v1/evaluations/**", (route) => replyEvaluation(route, state));
  return state;
}
