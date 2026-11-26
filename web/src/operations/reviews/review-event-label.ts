import type { MessageKey } from "@wolbachia/i18n";

const EVENT_LABELS: Record<string, MessageKey> = {
  "ovitrap.place": "reviews.event.ovitrapPlace",
  "ovitrap.check": "reviews.event.ovitrapCheck",
  "ovitrap.relocate": "reviews.event.ovitrapRelocate",
  "ovitrap.remove": "reviews.event.ovitrapRemove",
  "ovitrap.replace": "reviews.event.ovitrapReplace",
  "shift.open": "reviews.event.shiftOpen",
  "shift.close": "reviews.event.shiftClose",
  "incident.report": "reviews.event.incidentReport",
  "record.void": "reviews.event.recordVoid",
};

/** The plain-language name of a phone event type; an unknown type reads as a generic record. */
export function reviewEventKey(eventType: string): MessageKey {
  return EVENT_LABELS[eventType] ?? "reviews.event.other";
}
