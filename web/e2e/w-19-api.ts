import type { Page, Route } from "@playwright/test";
import type { Schemas } from "@wolbachia/api-client";
import { makeMe } from "../src/test/fake-api";
import { mockApi } from "./fixtures/mock-api";

export const REVIEW_ID = "16000000-0000-4000-8000-000000000001";
export const APPROVE_ID = "16000000-0000-4000-8000-000000000002";
export const REJECT_ID = "16000000-0000-4000-8000-000000000003";
const QUADRANT_ID = "16000000-0000-4000-8000-000000000004";
const VERSION_ID = "16000000-0000-4000-8000-000000000005";
const ACTOR_ID = "16000000-0000-4000-8000-000000000006";
const POINT_ID = "16000000-0000-4000-8000-000000000007";
const POINT_VERSION_ID = "16000000-0000-4000-8000-000000000008";
const DECISION_ID = "16000000-0000-4000-8000-000000000009";
const TASK_ID = "16000000-0000-4000-8000-000000000010";
const CLOSED_ID = "16000000-0000-4000-8000-000000000011";
const CLOCK = "2026-11-09T18:00:00Z";
export const TASK_CODE = "ND-160";
const pageOf = <T>(results: T[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});

const evaluation: Schemas["ReviewEvaluation"] = {
  can_accept: true,
  blockers: [],
  legacy_state: "none",
  subjects: [],
  scope_resolved: true,
  authority_proof_ids: [],
};

const decisionTemplate: Schemas["ReviewDecision"] = {
  id: DECISION_ID,
  review_item: REVIEW_ID,
  revision: 1,
  expected_revision: 0,
  is_terminal: true,
  decision_state: "accepted",
  audit_only: false,
  kind: "accept",
  reason: "",
  evidence_ids: [],
  evaluation,
  created_by: ACTOR_ID,
  created_at: CLOCK,
  safety_disposition: null,
  incident_id: null,
  effect_receipt: {
    id: DECISION_ID,
    source_event: REVIEW_ID,
    decision: DECISION_ID,
    mode: "applied_review",
    payload_sha256: "synthetic-review-source",
    handler_version: "e2e.v1",
    materialization: {},
    authority_proofs: [],
    observations: {},
    created_by: ACTOR_ID,
    created_at: CLOCK,
  },
};
function reviewDecision(reason: string): Schemas["ReviewDecision"] {
  return { ...decisionTemplate, reason };
}

const reviewTemplate: Schemas["ReviewItemDetail"] = {
  id: REVIEW_ID,
  event_id: REVIEW_ID,
  event_type: "ovitrap.reading",
  kind: "in_review",
  code: "clock_skew",
  params: {},
  courier: ACTOR_ID,
  device: ACTOR_ID,
  created_at: CLOCK,
  ingest_status: "in_review",
  decision_state: {
    revision: 0,
    kind: "pending",
    latest_kind: null,
    terminal: false,
    audit_only: false,
  },
  evaluation,
  timeline: [],
  original_event: {
    envelope: { id: REVIEW_ID, type: "ovitrap.reading", device_time: CLOCK },
    payload: { point_code: "P-160" },
    server_received_at: CLOCK,
    clock_skew_seconds: 7200,
    voided_at: null,
    provenance: {
      snapshot_id: REVIEW_ID,
      policy_version: "e2e.v1",
      point_version_id: POINT_VERSION_ID,
      rule_version_ids: {},
      rule_values: {},
      fuel_baseline_id: null,
      fuel_context_available: null,
    },
  },
};
function review(timeline: Schemas["ReviewDecision"][]): Schemas["ReviewItemDetail"] {
  const hasDecision = timeline.length > 0;
  return {
    ...reviewTemplate,
    timeline,
    decision_state: {
      ...reviewTemplate.decision_state,
      revision: timeline.length,
      kind: hasDecision ? "accepted" : "pending",
      latest_kind: hasDecision ? "accept" : null,
      terminal: hasDecision,
    },
  };
}

const relocationTemplate: Schemas["Relocation"] = {
  id: APPROVE_ID,
  code: APPROVE_ID,
  ovitrap: POINT_ID,
  point: POINT_ID,
  point_code: "P-160-A",
  point_version: POINT_VERSION_ID,
  old_location: [-99.12, 19.41],
  new_location: [-99.121, 19.411],
  reason_code: "access",
  reason_label: { "es-MX": "Acceso restringido", en: "Restricted access" },
  other_text: "",
  evidence_ids: [],
  evaluated_rules: {},
  rule_version_ids: {},
  event_id: APPROVE_ID,
  device_time: CLOCK,
  server_received_at: CLOCK,
  rules_version: "e2e.v1",
  catalog_version: "e2e.v1",
  manual_capture: false,
  gps: null,
  status: "pending",
  voided_at: null,
  void_reason: "",
  void_reason_code: "",
  created_by: ACTOR_ID,
  created_at: CLOCK,
};
function relocation(id: string, status = "pending"): Schemas["Relocation"] {
  return {
    ...relocationTemplate,
    id,
    code: id,
    event_id: id,
    status,
    point_code: id === APPROVE_ID ? "P-160-A" : "P-160-B",
  };
}

const quadrant: Schemas["Quadrant"] = {
  id: QUADRANT_ID,
  code: "Q-160",
  center: ACTOR_ID,
  created_by: ACTOR_ID,
  created_at: CLOCK,
  current_version: {
    id: VERSION_ID,
    quadrant: QUADRANT_ID,
    revision: 3,
    effective_from: CLOCK,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-99.2, 19.4],
          [-99.1, 19.4],
          [-99.1, 19.5],
          [-99.2, 19.4],
        ],
      ],
    },
    created_by: ACTOR_ID,
    created_at: CLOCK,
    point_resolutions: [],
  },
};

interface RecordedCommand {
  path: string;
  body: unknown;
}
interface JourneyState {
  commands: RecordedCommand[];
  timeline: Schemas["ReviewDecision"][];
  statuses: Map<string, string>;
  hasPhysicalBlockers: boolean;
  closure: Schemas["QuadrantClosure"] | null;
}
const PHYSICAL_BLOCKERS: Schemas["ClosureBlocker"][] = [
  { reason: "removal_unconfirmed", permission: "removal.confirm", id: POINT_ID, link: "" },
  { reason: "removal_unrecovered", permission: "removal.recover", id: POINT_VERSION_ID, link: "" },
];
const CLOSED_RECEIPT: Schemas["QuadrantClosure"] = {
  id: CLOSED_ID,
  quadrant_version: VERSION_ID,
  closed_at: CLOCK,
  revision: 3,
  created_by: ACTOR_ID,
  created_at: CLOCK,
};
const APPROVED_POINT: Schemas["PointVersion"] = {
  id: POINT_VERSION_ID,
  point: POINT_ID,
  location: [-99.121, 19.411],
  version: 2,
  effective_from: CLOCK,
  is_retired: false,
  created_by: ACTOR_ID,
  created_at: CLOCK,
};
const RELOCATION_DECISION: Schemas["RelocationDecision"] = {
  id: DECISION_ID,
  proposal: APPROVE_ID,
  event: APPROVE_ID,
  decision: "approved",
  reason: "",
  revision: 1,
  decided_at: CLOCK,
  published_point_version: POINT_VERSION_ID,
  created_by: ACTOR_ID,
  created_at: CLOCK,
};
const JOURNEY_ME = makeMe({
  permissions: [
    "review_item.read",
    "review_item.decide",
    "relocation.read",
    "relocation.decide",
    "quadrant.read",
    "quadrant.close",
  ],
  scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
});

/** Synthetic API wiring only: physical recovery is represented as a separate server state change. */
export async function mockReviewJourney(page: Page) {
  await mockApi(page, { me: JOURNEY_ME });
  const state: JourneyState = {
    commands: [],
    timeline: [],
    statuses: new Map(),
    hasPhysicalBlockers: true,
    closure: null,
  };
  await page.route("**/api/v1/review-items/**", (route) => replyReview(route, state));
  await page.route("**/api/v1/relocations/**", (route) => replyRelocation(route, state));
  await page.route("**/api/v1/quadrants/**", (route) => replyQuadrant(route, state));
  return {
    commands: state.commands,
    resolvePhysicalBlockers: () => {
      state.hasPhysicalBlockers = false;
    },
  };
}

function replyReview(route: Route, state: JourneyState) {
  const path = new URL(route.request().url()).pathname;
  if (route.request().method() === "POST") {
    const body = route.request().postDataJSON() as Schemas["ReviewDecisionRequestRequest"];
    state.commands.push({ path, body });
    const decision = reviewDecision(body.reason);
    state.timeline.push(decision);
    return route.fulfill({ status: 201, json: decision });
  }
  return route.fulfill({
    json:
      path === "/api/v1/review-items/" ? pageOf([review(state.timeline)]) : review(state.timeline),
  });
}

function replyRelocation(route: Route, state: JourneyState) {
  const url = new URL(route.request().url());
  if (route.request().method() === "POST") return decideRelocation(route, state);
  const code = url.searchParams.get("code");
  const status = url.searchParams.get("status");
  const rows = [APPROVE_ID, REJECT_ID].map((id) => relocation(id, state.statuses.get(id)));
  const results = rows.filter(
    (row) => (!code || row.code === code) && (!status || row.status === status),
  );
  return route.fulfill({ json: pageOf(results) });
}

function replyQuadrant(route: Route, state: JourneyState) {
  const path = new URL(route.request().url()).pathname;
  if (path.endsWith("/close/")) return replyClosure(route, state);
  if (path.endsWith("/closure/")) return replyReadiness(route, state);
  return route.fulfill({ json: pageOf([quadrant]) });
}

function replyClosure(route: Route, state: JourneyState) {
  const path = new URL(route.request().url()).pathname;
  state.commands.push({ path, body: route.request().postDataJSON() as unknown });
  state.closure = CLOSED_RECEIPT;
  return route.fulfill({ status: 201, json: state.closure });
}

function replyReadiness(route: Route, state: JourneyState) {
  const blockers = state.hasPhysicalBlockers ? PHYSICAL_BLOCKERS : [];
  const readiness: Schemas["QuadrantReadiness"] = {
    quadrant_id: QUADRANT_ID,
    quadrant_version_id: VERSION_ID,
    revision: 3,
    is_closed: state.closure !== null,
    can_close: blockers.length === 0 && state.closure === null,
    blockers,
    closure: state.closure,
  };
  return route.fulfill({ json: readiness });
}

function decideRelocation(route: Route, state: JourneyState) {
  const path = new URL(route.request().url()).pathname;
  const id = path.includes(APPROVE_ID) ? APPROVE_ID : REJECT_ID;
  const isApproved = path.endsWith("/approve/");
  const body = route.request().postDataJSON() as Schemas["RelocationDecisionRequestRequest"];
  state.commands.push({ path, body });
  state.statuses.set(id, isApproved ? "approved" : "rejected");
  const result: Schemas["RelocationDecisionResult"] = {
    decision: {
      ...RELOCATION_DECISION,
      proposal: id,
      event: id,
      decision: isApproved ? "approved" : "rejected",
      reason: body.reason,
      published_point_version: isApproved ? POINT_VERSION_ID : null,
    },
    point_version: isApproved ? APPROVED_POINT : null,
    next_day_task: isApproved ? null : { id: TASK_ID, code: TASK_CODE, due_date: "2026-11-10" },
    warnings: [],
  };
  return route.fulfill({ status: 201, json: result });
}
