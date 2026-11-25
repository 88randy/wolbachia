import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { eventTypeKey } from "../../sync/inbox-model.ts";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import type { OutboxStatus } from "../../outbox/outbox-status.ts";

export interface HistoryEntry {
  readonly id: string;
  readonly kind: string;
  readonly sourceId: string | null;
  readonly shiftId: string | null;
  readonly time: string | null;
  readonly codes: readonly string[];
  readonly status: OutboxStatus | "reviewed" | "voided" | "observed";
  readonly reason: string | null;
  readonly author: string | null;
  readonly voidsId: string | null;
  readonly isServerDecision: boolean;
  readonly observation: { readonly es: string; readonly en: string } | null;
}
/** D1 (#373): an own outbox event without a point subject; never codes, reason or payload. */
export interface UnscopedEntry {
  readonly id: string;
  readonly kind: string;
  readonly time: string | null;
  readonly status: OutboxStatus;
}
export interface HistoryView {
  readonly available: boolean;
  readonly entries: readonly HistoryEntry[];
  /** P33 only; P29 ignores it. */
  readonly unscoped: readonly UnscopedEntry[];
}
export const UNAVAILABLE_HISTORY: HistoryView = { available: false, entries: [], unscoped: [] };
export interface HistoryGroup {
  readonly id: string;
  readonly date: string | null;
  readonly shiftId: string | null;
  readonly entries: readonly HistoryEntry[];
}
export function text(row: object, key: string): string | null {
  const value: unknown = Reflect.get(row, key);
  return typeof value === "string" && value.length > 0 ? value : null;
}
function isVoided(row: object): boolean {
  return (
    Reflect.get(row, "voided") === true ||
    Reflect.get(row, "is_voided") === true ||
    firstText(row, ["voided_at", "source_voided_at"]) !== null ||
    text(row, "decision_state") === "voided"
  );
}
function firstText(row: object, keys: readonly string[]): string | null {
  return keys.map((key) => text(row, key)).find((value) => value !== null) ?? null;
}
function serverStatus(row: Schemas["CourierHistoryEntry"]): HistoryEntry["status"] {
  if (isVoided(row)) return "voided";
  if (text(row, "decision_state") === "observed") return "observed";
  if (row.kind === "relocation_proposal") {
    if (row.status === "approved") return "reviewed";
    return row.status === "rejected" ? "rejected" : "in_review";
  }
  if (["accepted", "approved"].includes(text(row, "decision_state") ?? "")) return "reviewed";
  const status = text(row, "source_status");
  if (status === "in_review" || status === "rejected") return status;
  return "sent";
}
export function localHistory(
  event: OutboxEvent,
  codes: readonly string[],
  author: string,
): HistoryEntry {
  return {
    id: event.envelope.id,
    kind: event.envelope.type,
    sourceId: event.envelope.id,
    shiftId: event.envelope.shift_id ?? null,
    time: event.envelope.device_time,
    codes,
    status: event.status,
    reason: firstText(event.envelope.payload, ["reason", "other_text"]),
    author,
    voidsId: event.envelope.voids_event_id ?? null,
    isServerDecision: false,
    observation: null,
  };
}
export function serverHistory(
  row: Schemas["CourierHistoryEntry"],
  original?: HistoryEntry,
): HistoryEntry {
  const codes = [
    text(row, "point_code"),
    text(row, "transfer_code"),
    text(row, "code"),
    ...(original?.codes ?? []),
  ].filter((code): code is string => code !== null);
  return {
    id: `${row.kind}:${row.id}`,
    kind: row.kind,
    sourceId: firstText(row, ["source_event_id", "proposal_event_id"]),
    shiftId: text(row, "shift_id") ?? original?.shiftId ?? null,
    time:
      firstText(row, ["decided_at", "recorded_at", "created_at", "at", "source_device_time"]) ??
      original?.time ??
      null,
    codes: [...new Set(codes)],
    status: serverStatus(row),
    reason: text(row, "reason"),
    author: firstText(row, ["decided_by", "author_id", "actor_id"]),
    voidsId: text(row, "declared_void_target_uuid"),
    isServerDecision: true,
    observation: null,
  };
}
/**
 * Office verdicts on an own event: exact decision kinds only (lab facts about a bag are not a
 * verdict on the capture) with a verdict status; any other server fact stays a separate row.
 */
const DECISION_KINDS: readonly string[] = ["review_decision", "relocation_proposal"];
const DECISION_STATUSES: readonly HistoryEntry["status"][] = [
  "voided",
  "reviewed",
  "rejected",
  "observed",
];
const instant = (time: string | null) => {
  const value = time === null ? NaN : Date.parse(time);
  return Number.isFinite(value) ? value : -Infinity;
};
/** Later decision wins; equal times fall back to the id so the result is deterministic. */
const isLater = (left: HistoryEntry, right: HistoryEntry) =>
  instant(left.time) - instant(right.time) || left.id.localeCompare(right.id);
/**
 * A server decision on one of the courier's own visible events folds into that event's row
 * (P29 and P33): the latest decision gives its status, reason and author, and the separate
 * decision row is not listed. Decisions without a visible original keep their own row.
 */
export function foldDecisions(entries: readonly HistoryEntry[]): readonly HistoryEntry[] {
  const originals = new Set(entries.filter((entry) => !entry.isServerDecision).map((e) => e.id));
  const isFolded = (entry: HistoryEntry) =>
    entry.isServerDecision &&
    DECISION_KINDS.includes(entry.kind) &&
    entry.sourceId !== null &&
    originals.has(entry.sourceId) &&
    DECISION_STATUSES.includes(entry.status);
  const latest = new Map<string, HistoryEntry>();
  for (const decision of entries.filter(isFolded)) {
    const key = decision.sourceId ?? "";
    const current = latest.get(key);
    if (current === undefined || isLater(decision, current) > 0) latest.set(key, decision);
  }
  return entries
    .filter((entry) => !isFolded(entry))
    .map((entry) => {
      const decision = entry.isServerDecision ? undefined : latest.get(entry.id);
      if (decision === undefined) return entry;
      return {
        ...entry,
        status: decision.status,
        reason: decision.reason ?? entry.reason,
        author: decision.author ?? entry.author,
      };
    });
}
/** Server history kinds that name the field event they concern. */
const SERVER_KIND_TYPES: Readonly<Record<string, string>> = {
  relocation_proposal: "ovitrap.relocate",
  community_activity: "community.activity",
};
/** Row title: the event type when known (local `a.b` types or a typed server kind), else the office note. */
export function historyTitleKey(kind: string): MessageKey {
  const type = SERVER_KIND_TYPES[kind] ?? kind;
  return type.includes(".") ? eventTypeKey(type) : "mobile.history.serverFact";
}
/** This index searches only known local code/identity fields, never arbitrary private payload text. */
export function filterHistory(
  entries: readonly HistoryEntry[],
  search: string,
): readonly HistoryEntry[] {
  const query = search.trim().toLocaleLowerCase();
  return entries
    .filter(
      (entry) =>
        !query ||
        [entry.id, entry.shiftId, entry.sourceId, entry.voidsId, ...entry.codes].some((value) =>
          value?.toLocaleLowerCase().includes(query),
        ),
    )
    .sort(
      (left, right) =>
        (right.time ?? "").localeCompare(left.time ?? "") || left.id.localeCompare(right.id),
    );
}
export function groupHistory(
  entries: readonly HistoryEntry[],
  timezone: string,
): readonly HistoryGroup[] {
  const groups = new Map<string, HistoryGroup>();
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (const entry of entries) {
    const date =
      entry.time && Number.isFinite(Date.parse(entry.time))
        ? format.format(new Date(entry.time))
        : null;
    const id = entry.shiftId ?? date ?? "unknown";
    const previous = groups.get(id);
    groups.set(id, {
      id,
      date,
      shiftId: entry.shiftId,
      entries: [...(previous?.entries ?? []), entry],
    });
  }
  return [...groups.values()];
}
