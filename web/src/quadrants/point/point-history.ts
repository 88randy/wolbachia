import type { Schemas } from "@wolbachia/api-client";

type Reading = Schemas["Reading"];
type Ovitrap = Schemas["Ovitrap"];
type Entry = Schemas["HistoryEntry"];

export type HistoryKind = "place" | "replace" | "relocate" | "remove" | "check";
export type EggsAnswer = "yes" | "no" | "noPaddle";

/** One line of what happened at a point: a movement of the ovitrap or a check. */
export interface HistoryRow {
  id: string;
  kind: HistoryKind;
  at: string;
  by: string | null;
  /** Human code of the ovitrap involved (the old one on a replacement). */
  ovitrapCode: string | null;
  /** Human code of the new ovitrap, only on a replacement. */
  nextCode: string | null;
  /** The answer of a check; null on a movement. */
  eggs: EggsAnswer | null;
  voided: { reason: string } | null;
}

const MOVEMENTS: Readonly<Record<string, HistoryKind>> = {
  "ovitrap.place": "place",
  "ovitrap.replace": "replace",
  "ovitrap.relocate": "relocate",
  "ovitrap.remove": "remove",
};

/** Ids come with or without dashes depending on who wrote them: compare them bare. */
const bare = (id: unknown) => (typeof id === "string" ? id.replaceAll("-", "").toLowerCase() : "");

/** Codes of the ovitraps of the point, by bare id. */
export function codesById(ovitraps: readonly Ovitrap[]): Map<string, string> {
  return new Map(ovitraps.map((trap) => [bare(trap.id), trap.code]));
}

function payloadField(payload: unknown, name: string): unknown {
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)[name]
    : undefined;
}

function movementRows(entries: readonly Entry[], codes: Map<string, string>): HistoryRow[] {
  return entries.flatMap((entry) => {
    const kind = MOVEMENTS[entry.type];
    if (!kind) return [];
    return [
      {
        id: entry.event_id,
        kind,
        at: entry.device_time,
        by: entry.author_name ?? null,
        ovitrapCode: codes.get(bare(payloadField(entry.payload, "ovitrap_id"))) ?? null,
        nextCode: codes.get(bare(payloadField(entry.payload, "replacement_id"))) ?? null,
        eggs: null,
        voided: entry.voided_at ? { reason: entry.void_reason } : null,
      },
    ];
  });
}

function eggsOf(reading: Reading): EggsAnswer {
  if (!reading.paddle_present) return "noPaddle";
  return reading.has_eggs ? "yes" : "no";
}

function checkRows(readings: readonly Reading[], codes: Map<string, string>): HistoryRow[] {
  return readings.map((reading) => ({
    id: reading.id,
    kind: "check" as const,
    at: reading.device_time,
    by: reading.created_by_name ?? null,
    ovitrapCode: codes.get(bare(reading.ovitrap)) ?? null,
    nextCode: null,
    eggs: eggsOf(reading),
    voided: reading.voided_at ? { reason: reading.void_reason } : null,
  }));
}

/** Movements and checks of one point in one list, newest first. */
export function buildHistory(
  entries: readonly Entry[],
  readings: readonly Reading[],
  ovitraps: readonly Ovitrap[],
): HistoryRow[] {
  const codes = codesById(ovitraps);
  return [...movementRows(entries, codes), ...checkRows(readings, codes)].sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id),
  );
}

/** The ovitrap that is at the point now: not replaced, not removed, not voided. */
export function currentOvitrap(ovitraps: readonly Ovitrap[]): Ovitrap | null {
  return ovitraps.find((trap) => !trap.is_retired && trap.voided_at === null) ?? null;
}

/** A bag collected at the point. */
export interface PointBag {
  code: string;
  at: string;
  by: string | null;
  week: string;
  voided: { reason: string } | null;
}

/** The bags of the checks that carried a paddle, newest first. */
export function pointBags(readings: readonly Reading[]): PointBag[] {
  return readings
    .flatMap((reading) =>
      reading.bag_code
        ? [
            {
              code: reading.bag_code,
              at: reading.device_time,
              by: reading.created_by_name ?? null,
              week: reading.epi_week,
              voided: reading.voided_at ? { reason: reading.void_reason } : null,
            },
          ]
        : [],
    )
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
