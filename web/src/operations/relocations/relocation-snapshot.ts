import type { MessageKey } from "@wolbachia/i18n";
import type { Relocation } from "./relocations-query";
/** Unknown JSON projections remain captured evidence, never browser business rules. */
export function snapshotText(value: unknown): string {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}
/** B15 captures catalog labels under the actual es-MX/en locale keys. */
export function relocationReasonLabel(value: unknown, language: string): string {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null) return "";
  const labels = value as Record<string, unknown>;
  const label = labels[language === "en" ? "en" : "es-MX"];
  return typeof label === "string" ? label : "";
}
export function relocationStatusKey(status: string) {
  if (status === "pending") return "relocations.workspace.pending" as const;
  if (status === "approved") return "relocations.workspace.approved" as const;
  if (status === "rejected") return "relocations.workspace.rejected" as const;
  return "relocations.workspace.unavailable" as const;
}
export function relocationFields(
  proposal: Relocation,
  format: (iso: string) => string,
  language: string,
): [MessageKey, string][] {
  return [
    ["relocations.workspace.point", proposal.point_code],
    ["relocations.workspace.ovitrap", proposal.ovitrap],
    ["relocations.workspace.oldLocation", snapshotText(proposal.old_location)],
    ["relocations.workspace.newLocation", snapshotText(proposal.new_location)],
    ["relocations.workspace.pointVersion", proposal.point_version],
    [
      "relocations.workspace.reason",
      `${relocationReasonLabel(proposal.reason_label, language) || proposal.reason_code} ${proposal.other_text}`,
    ],
    ["relocations.workspace.author", proposal.created_by ?? ""],
    ["relocations.workspace.deviceTime", format(proposal.device_time)],
    ["relocations.workspace.receivedAt", format(proposal.server_received_at)],
    ["relocations.workspace.evidence", snapshotText(proposal.evidence_ids)],
  ];
}
