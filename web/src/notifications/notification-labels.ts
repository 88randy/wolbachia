import type { MessageKey } from "@wolbachia/i18n";
import type { Notification } from "./notification-query";
const KINDS = {
  critical: "notifications.kind.critical",
  incident: "notifications.kind.incident",
  training: "notifications.kind.training",
  system: "notifications.kind.system",
} as const satisfies Record<Notification["kind"], MessageKey>;
const CODES: Readonly<Record<string, MessageKey>> = {
  "incident.created": "notifications.message.incidentCreated",
  "incident.comment": "notifications.message.incidentComment",
  "incident.reassigned": "notifications.message.incidentReassigned",
  "incident.severity_changed": "notifications.message.incidentSeverityChanged",
  "incident.closed": "notifications.message.incidentClosed",
  "incident.escalated": "notifications.message.incidentEscalated",
  "incident.critical_source": "notifications.message.incidentCriticalSource",
  "incident.critical_review": "notifications.message.incidentCriticalReview",
  "incident.severe_fault": "notifications.message.incidentSevereFault",
  "training.certification_expired": "notifications.message.certificationExpired",
  "training.third_adverse": "notifications.message.thirdAdverse",
  "notification.system": "notifications.message.system",
};
export function notificationKindKey(kind: Notification["kind"]): MessageKey {
  return KINDS[kind];
}
export function notificationMessageKey(code: string): MessageKey {
  return CODES[code] ?? "notifications.inbox.unknown";
}
