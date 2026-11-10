import type { Schemas } from "@wolbachia/api-client";
export const ID = "00000000-0000-4000-8000-000000000033";
export const PROOF = "00000000-0000-4000-8000-000000000034";
export const event: Schemas["IncidentEvent"] = {
  id: "event-1",
  revision: 1,
  action: "report",
  state: "open",
  owner: ID,
  stage: 0,
  severity: "critical",
  stage_entered_at: "2026-11-01T12:00:00Z",
  deadline: null,
  last_reminder_at: "2026-11-01T12:00:00Z",
  text: "Original report",
  evidence_ids: [],
  resolved_blocker_ids: [],
  actor_kind: "human",
  created_by: ID,
  created_at: "2026-11-01T12:00:00Z",
  policy_version: "1",
  author_display: "Test supervisor",
};
const BASE_INCIDENT: Schemas["ReportedIncident"] = {
  id: ID,
  code: "I-0033",
  type_version: ID,
  center: ID,
  quadrant: null,
  source_event: null,
  device_time: event.created_at,
  server_received_at: event.created_at,
  description: "Synthetic incident",
  revision: 2,
  state: "open",
  owner_id: ID,
  severity: "critical",
  deadline: "2026-11-03T12:00:00Z",
  timeline: [
    event,
    { ...event, id: "event-2", revision: 2, action: "escalate", text: "Escalation audit" },
  ],
  publication_state: "outboxed",
  created_at: event.created_at,
  created_by: ID,
  stage: 1,
  owner_display: "Test coordinator",
  type_snapshot: {
    id: ID,
    code: "other",
    label: "Other incident",
    icon: "",
    is_other: true,
    report_evidence_min: 0,
    close_evidence_min: 1,
  },
  origin: "direct_report",
  linked_record: { kind: "motorcycle", available: true, id: ID, code: "M-03", is_voided: true },
  blockers: [],
  evidence: [],
  action_permissions: {
    comment: true,
    close: true,
    reassign: true,
    change_severity: true,
    void: true,
  },
  action_prerequisites: {
    is_open: true,
    has_void_dependents: true,
    is_severity_protected: false,
    close_evidence_min: 1,
    can_upload_evidence: true,
  },
};

export function incident(
  overrides: Partial<Schemas["ReportedIncident"]> = {},
): Schemas["ReportedIncident"] {
  return { ...BASE_INCIDENT, ...overrides };
}
