import type { MessageKey } from "@wolbachia/i18n";
import type { BagTrace } from "./trace-query";

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;
type Actor = { name: string } | null;
interface VoidFact {
  at: string;
  by: Actor;
  reason: string;
}

/** Install, collect, receive, count, sample received, result, PCR: the order of the real process. */
export const STEP_RANK = {
  installed: 0,
  collected: 1,
  received: 2,
  count: 3,
  sample: 4,
  result: 5,
  pcr: 6,
} as const;
type StepRank = (typeof STEP_RANK)[keyof typeof STEP_RANK];

/** One line of the paddle's story. `at === null` means it has not happened yet. */
export interface TimelineStep {
  id: string;
  /** Logical order, used only to break ties between steps with the same timestamp. */
  rank: StepRank;
  label: string;
  at: string | null;
  by: string | null;
  note?: string;
  voided?: { at: string; by: string | null; reason: string };
}

const nameOf = (actor: Actor) => (actor && actor.name !== "" ? actor.name : null);
const voidOf = (fact: VoidFact | null) =>
  fact ? { at: fact.at, by: nameOf(fact.by), reason: fact.reason } : undefined;

function fieldSteps(trace: BagTrace, t: Translate): TimelineStep[] {
  const { installed, reading } = trace;
  return [
    {
      id: "installed",
      rank: STEP_RANK.installed,
      label: t("labTrace.step.installed"),
      at: installed.at,
      by: nameOf(installed.by),
      note: t(
        installed.basis === "placement"
          ? "labTrace.installedFromPlacement"
          : "labTrace.installedFromReading",
      ),
    },
    {
      id: "collected",
      rank: STEP_RANK.collected,
      label: t("labTrace.step.collected"),
      at: reading.device_time,
      by: nameOf(reading.courier),
    },
  ];
}

function resultText(t: Translate, status: string, result: string | null) {
  const key = result ?? (status === "valid" ? "missing" : status);
  return t(`labTrace.result.${key}` as MessageKey);
}

type Sample = NonNullable<BagTrace["lab"]>["wolbachia"][number];

function receivedStep(sample: Sample, t: Translate): TimelineStep[] {
  return sample.received_at
    ? [
        {
          id: `sample-${sample.sample_code}`,
          rank: STEP_RANK.sample,
          label: t("labTrace.step.sampleReceived", { code: sample.sample_code }),
          at: sample.received_at,
          by: null,
        },
      ]
    : [];
}

function sampleSteps(lab: NonNullable<BagTrace["lab"]>, t: Translate): TimelineStep[] {
  return lab.wolbachia.flatMap((sample) => [
    ...receivedStep(sample, t),
    ...sample.results.map((row) => ({
      id: `result-${sample.sample_code}-${String(row.revision)}`,
      rank: STEP_RANK.result,
      label: t("labTrace.step.result", { result: resultText(t, row.status, row.result) }),
      at: row.at,
      by: nameOf(row.by),
    })),
    ...sample.pcr.map((row) => ({
      id: `pcr-${sample.sample_code}-${row.target}-${row.at}`,
      rank: STEP_RANK.pcr,
      label: t("labTrace.step.pcr", {
        target: t(`labTrace.target.${row.target}` as MessageKey),
        outcome: t(`labTrace.outcome.${row.outcome}` as MessageKey),
      }),
      at: row.at,
      by: nameOf(row.by),
    })),
  ]);
}

function resultSteps(lab: NonNullable<BagTrace["lab"]>, t: Translate): TimelineStep[] {
  const steps: TimelineStep[] = [
    ...lab.counts.map((row) => ({
      id: `count-${row.id}`,
      rank: STEP_RANK.count,
      label: t("labTrace.step.count", { n: row.ordinal }),
      at: row.at,
      by: nameOf(row.by),
      voided: voidOf(row.void),
    })),
    ...lab.rejections.map((row) => ({
      id: `rejection-${row.id}`,
      rank: STEP_RANK.count,
      label: t("labTrace.step.rejected"),
      at: row.at,
      by: nameOf(row.by),
      note: row.reason,
      voided: voidOf(row.void),
    })),
    ...lab.recounts.map((row) => ({
      id: `recount-${row.role}-${row.at}`,
      rank: STEP_RANK.count,
      label: t("labTrace.step.recount", { role: t(`labTrace.role.${row.role}` as MessageKey) }),
      at: row.at,
      by: nameOf(row.by),
    })),
    ...sampleSteps(lab, t),
  ];
  return steps;
}

function labSteps(lab: BagTrace["lab"], t: Translate): TimelineStep[] {
  if (!lab) return [];
  const received: TimelineStep = {
    id: "received",
    rank: STEP_RANK.received,
    label: t("labTrace.step.received"),
    at: lab.receipt?.at ?? null,
    by: nameOf(lab.receipt?.by ?? null),
  };
  const results = resultSteps(lab, t);
  const needsCount = lab.receipt !== null && results.length === 0;
  const pending: TimelineStep = {
    id: "count-pending",
    rank: STEP_RANK.count,
    label: t("labTrace.step.count", { n: 1 }),
    at: null,
    by: null,
  };
  return [received, ...results, ...(needsCount ? [pending] : [])];
}

function byTime(a: TimelineStep, b: TimelineStep): number {
  const gap = Date.parse(a.at ?? "") - Date.parse(b.at ?? "");
  return gap !== 0 && !Number.isNaN(gap) ? gap : a.rank - b.rank;
}

/**
 * Installed, collected, received, counted, recounted, results: each with its date and author,
 * oldest first. Equal timestamps keep the real process order; a step that has not happened yet
 * goes last. A voided step stays where its own date puts it.
 */
export function buildTimeline(trace: BagTrace, t: Translate): TimelineStep[] {
  const all = [...fieldSteps(trace, t), ...labSteps(trace.lab, t)];
  const done = all.filter((step) => step.at !== null).sort(byTime);
  return [...done, ...all.filter((step) => step.at === null)];
}

export interface CoordinateRow {
  id: "point" | "capture";
  lat: number;
  lng: number;
  accuracyM: number | null;
}

/** The two places on the map as plain numbers: the text equivalent of the map. */
export function coordinateRows(trace: BagTrace): CoordinateRow[] {
  const [lng = 0, lat = 0] = trace.location.point.location;
  const { capture } = trace.reading;
  return [
    { id: "point", lat, lng, accuracyM: null },
    ...(capture
      ? [
          {
            id: "capture" as const,
            lat: capture.lat,
            lng: capture.lng,
            accuracyM: capture.accuracy_m,
          },
        ]
      : []),
  ];
}
