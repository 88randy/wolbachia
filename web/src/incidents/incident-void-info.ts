import type { Incident } from "./incidents-query";
/** The void event is the retained source of the row's correction reason and author. */
export function incidentVoidInfo(incident: Incident, unavailable: string) {
  if (incident.state !== "voided") return null;
  const event = [...incident.timeline].reverse().find((entry) => entry.action === "void");
  return { reason: event?.text || unavailable, author: event?.author_display ?? unavailable };
}
