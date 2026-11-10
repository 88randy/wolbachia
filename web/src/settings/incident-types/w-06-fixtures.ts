import type { Schemas } from "@wolbachia/api-client";
export const W64_OWNERS = [
  {
    membership_id: "00000000-0000-4000-8000-000000000011",
    label: "Supervisión",
    is_terminal_eligible: false,
  },
  {
    membership_id: "00000000-0000-4000-8000-000000000012",
    label: "Coordinación",
    is_terminal_eligible: false,
  },
  {
    membership_id: "00000000-0000-4000-8000-000000000013",
    label: "Responsable de guardia",
    is_terminal_eligible: true,
  },
] as const;
export const W64_TYPE: Schemas["IncidentType"] = {
  id: "00000000-0000-4000-8000-000000000001",
  current_version_id: "00000000-0000-4000-8000-000000000002",
  revision: 2,
  code: "unrecovered",
  label: "Ovitrampa no recuperada",
  icon: "trap",
  is_other: false,
  is_active: true,
  severity: "critical",
  supervisor: W64_OWNERS[0].membership_id,
  coordinator: W64_OWNERS[1].membership_id,
  terminal: W64_OWNERS[2].membership_id,
  supervisor_display: "Supervisión",
  coordinator_display: "Coordinación",
  terminal_display: "Responsable de guardia",
  supervisor_sla_seconds: 3600,
  coordinator_sla_seconds: 7200,
  report_evidence_min: 1,
  close_evidence_min: 2,
  blocker_kinds: ["dispatch", "quadrant_closure"],
};
export function incidentTypePage(results: unknown[]) {
  return { results, count: results.length, next: null, previous: null };
}
