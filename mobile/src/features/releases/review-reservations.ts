import type { Schemas } from "@wolbachia/api-client";

/** Original ingest stays immutable; only an exact-source terminal disposition settles a hold. */
export function discardedSources(history: readonly Schemas["CourierHistoryEntry"][]): string[] {
  const latest = new Map<string, Schemas["ReviewHistoryEntry"]>();
  for (const entry of history) {
    if (entry.kind !== "review_decision" || entry.source_event_id === null) continue;
    const previous = latest.get(entry.source_event_id);
    if (!previous || entry.revision > previous.revision) latest.set(entry.source_event_id, entry);
  }
  return [...latest]
    .filter(([, entry]) => entry.is_terminal === true && entry.effect_state === "discarded")
    .map(([id]) => id);
}
