import type { MessageKey } from "@wolbachia/i18n";
import type { BagTrace } from "./trace-query";

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;
type Actor = { name: string } | null;
interface VoidFact {
  at: string;
  by: Actor;
  reason: string;
}

/** One line of the paddle's story. `at === null` means it has not happened yet. */
export interface TimelineStep {
  id: string;
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

function sampleSteps(lab: NonNullable<BagTrace["lab"]>, t: Translate): TimelineStep[] {
  return lab.wolbachia.flatMap((sample) => [
    ...(sample.received_at
      ? [
          {
            id: `sample-${sample.sample_code}`,
            label: t("labTrace.step.sampleReceived", { code: sample.sample_code }),
            at: sample.received_at,
            by: null,
          },
        ]
      : []),
    ...sample.results.map((row) => ({
      id: `result-${sample.sample_code}-${String(row.revision)}`,
      label: t("labTrace.step.result", { result: resultText(t, row.status, row.result) }),
      at: row.at,
      by: nameOf(row.by),
    })),
    ...sample.pcr.map((row) => ({
      id: `pcr-${sample.sample_code}-${row.target}-${row.at}`,
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
      label: t("labTrace.step.count", { n: row.ordinal }),
      at: row.at,
      by: nameOf(row.by),
      voided: voidOf(row.void),
    })),
    ...lab.rejections.map((row) => ({
      id: `rejection-${row.id}`,
      label: t("labTrace.step.rejected"),
      at: row.at,
      by: nameOf(row.by),
      note: row.reason,
      voided: voidOf(row.void),
    })),
    ...lab.recounts.map((row) => ({
      id: `recount-${row.role}-${row.at}`,
      label: t("labTrace.step.recount", { role: t(`labTrace.role.${row.role}` as MessageKey) }),
      at: row.at,
      by: nameOf(row.by),
    })),
    ...sampleSteps(lab, t),
  ];
  return steps.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

function labSteps(lab: BagTrace["lab"], t: Translate): TimelineStep[] {
  if (!lab) return [];
  const received: TimelineStep = {
    id: "received",
    label: t("labTrace.step.received"),
    at: lab.receipt?.at ?? null,
    by: nameOf(lab.receipt?.by ?? null),
  };
  const results = resultSteps(lab, t);
  const needsCount = lab.receipt !== null && results.length === 0;
  const pending: TimelineStep = {
    id: "count-pending",
    label: t("labTrace.step.count", { n: 1 }),
    at: null,
    by: null,
  };
  return [received, ...results, ...(needsCount ? [pending] : [])];
}

/** Installed, collected, received, counted, recounted, results: each with its date and author. */
export function buildTimeline(trace: BagTrace, t: Translate): TimelineStep[] {
  return [...fieldSteps(trace, t), ...labSteps(trace.lab, t)];
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
