import { randomUUID } from "node:crypto";
import type { Schemas } from "@wolbachia/api-client";
const CAPTURE_TIME = "2026-11-01T12:00:00Z";

export function incidentType(): Schemas["IncidentType"] {
  return {
    id: randomUUID(),
    current_version_id: randomUUID(),
    revision: 3,
    code: "work-incident",
    label: "Work incident",
    icon: "warning",
    is_other: false,
    is_active: true,
    severity: "high",
    supervisor: randomUUID(),
    coordinator: null,
    terminal: randomUUID(),
    supervisor_display: null,
    coordinator_display: null,
    terminal_display: null,
    supervisor_sla_seconds: 3600,
    coordinator_sla_seconds: 7200,
    report_evidence_min: 1,
    close_evidence_min: 1,
    blocker_kinds: [],
  };
}

export function commentEvent(): Schemas["IncidentEvent"] {
  return {
    id: randomUUID(),
    revision: 2,
    action: "comment",
    state: "open",
    owner: randomUUID(),
    stage: 0,
    severity: "high",
    stage_entered_at: CAPTURE_TIME,
    deadline: null,
    last_reminder_at: CAPTURE_TIME,
    text: "Supervisor follow-up",
    evidence_ids: [],
    resolved_blocker_ids: [],
    actor_kind: "human",
    created_by: randomUUID(),
    created_at: CAPTURE_TIME,
    policy_version: "3",
    author_display: "Supervisor test",
  };
}

function incidentActions(): Schemas["IncidentActionPermissions"] {
  return { comment: true, reassign: false, change_severity: false, close: false, void: false };
}
function incidentClocks() {
  return { device_time: CAPTURE_TIME, server_received_at: CAPTURE_TIME, created_at: CAPTURE_TIME };
}
export function reportedIncident(): Schemas["ReportedIncident"] {
  return {
    id: randomUUID(),
    code: "I-000001",
    type_version: randomUUID(),
    center: randomUUID(),
    quadrant: null,
    source_event: randomUUID(),
    ...incidentClocks(),
    description: "Captured incident",
    revision: 2,
    state: "open",
    owner_id: randomUUID(),
    severity: "high",
    deadline: null,
    timeline: [commentEvent()],
    publication_state: "outboxed",
    created_by: randomUUID(),
    stage: 0,
    owner_display: "Supervisor test",
    type_snapshot: null,
    origin: "field_event",
    linked_record: { kind: null, available: false, id: null, code: null, is_voided: null },
    blockers: [],
    evidence: [],
    action_permissions: incidentActions(),
    action_prerequisites: null,
  };
}
