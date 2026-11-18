import { expect, test } from "vitest";
import type { MessageKey } from "@wolbachia/i18n";
import { messages } from "@wolbachia/i18n";
import { makeTrace } from "./trace-fixtures";
import { boundsOf, circleRing } from "./trace-geometry";
import { buildTimeline, coordinateRows } from "./trace-model";

function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    messages["en"][key],
  );
}

test("the story runs installed, collected, received, counts, then the Wolbachia result", () => {
  const steps = buildTimeline(makeTrace(), t);
  expect(steps.map((step) => step.id)).toEqual([
    "installed",
    "collected",
    "received",
    "count-00000000-0000-4000-8000-0000000000c1",
    "count-00000000-0000-4000-8000-0000000000c2",
    "sample-S-0001",
    "result-S-0001-1",
  ]);
  expect(steps[0]).toMatchObject({ by: "Luis Repartidor", note: "Date of the previous check" });
  expect(steps.at(-1)?.label).toBe("Wolbachia result: positive");
});

test("steps are sorted by their own timestamp, not by the order the API lists them", () => {
  const trace = makeTrace();
  const lab = trace.lab as NonNullable<typeof trace.lab>;
  // The receipt happened after the first count was typed in: the story follows the dates.
  const late = { ...lab, receipt: { at: "2026-11-11T16:30:00Z", by: null } };
  const ids = buildTimeline({ ...trace, lab: late }, t).map((step) => step.id);
  const first = ids.indexOf("count-00000000-0000-4000-8000-0000000000c1");
  const second = ids.indexOf("count-00000000-0000-4000-8000-0000000000c2");
  expect(first).toBeLessThan(ids.indexOf("received"));
  expect(ids.indexOf("received")).toBeLessThan(second);
});

test("steps with the same timestamp keep the process order and a voided one stays in place", () => {
  const trace = makeTrace();
  const lab = trace.lab as NonNullable<typeof trace.lab>;
  const same = "2026-11-12T10:00:00Z";
  const tied = {
    ...lab,
    receipt: { at: same, by: null },
    counts: lab.counts.map((count) => ({ ...count, at: same })),
    wolbachia: lab.wolbachia.map((sample) => ({
      ...sample,
      received_at: same,
      results: sample.results.map((row) => ({ ...row, at: same })),
    })),
  };
  const steps = buildTimeline(
    {
      ...trace,
      installed: { ...trace.installed, at: same },
      reading: { ...trace.reading, device_time: same },
      lab: tied,
    },
    t,
  );
  expect(steps.map((step) => step.rank)).toEqual([0, 1, 2, 3, 3, 4, 5]);
  expect(steps.find((step) => step.label === "Egg count 1")?.voided).toBeDefined();
});

test("a voided count stays in the story with its reason and author", () => {
  const voided = buildTimeline(makeTrace(), t).find((step) => step.label === "Egg count 1");
  expect(voided?.voided).toEqual({
    at: "2026-11-11T17:00:00Z",
    by: "Ana Laboratorio",
    reason: "Error al capturar",
  });
});

test("a received bag with no result yet shows the count as still missing", () => {
  const trace = makeTrace();
  const lab = { ...trace.lab, counts: [], wolbachia: [] } as NonNullable<typeof trace.lab>;
  const steps = buildTimeline({ ...trace, lab }, t);
  expect(steps.at(-1)).toMatchObject({ id: "count-pending", at: null });
});

test("without lab permission the story stops at the field steps", () => {
  const steps = buildTimeline(makeTrace({ lab: null }), t);
  expect(steps.map((step) => step.id)).toEqual(["installed", "collected"]);
});

test("coordinates list the point first and the courier reading second, with accuracy", () => {
  expect(coordinateRows(makeTrace())).toEqual([
    { id: "point", lat: 20.97, lng: -89.62, accuracyM: null },
    { id: "capture", lat: 20.9701, lng: -89.6201, accuracyM: 8 },
  ]);
  const trace = makeTrace();
  expect(coordinateRows({ ...trace, reading: { ...trace.reading, capture: null } })).toHaveLength(
    1,
  );
});

test("the accuracy circle closes and keeps its radius around the reading", () => {
  const ring = circleRing(-89.62, 20.97, 50);
  expect(ring[0]).toEqual(ring.at(-1));
  const north = Math.max(...ring.map((vertex) => vertex[1] ?? 0));
  const metersNorth = ((north - 20.97) * Math.PI * 6_371_008.8) / 180;
  expect(metersNorth).toBeGreaterThan(49);
  expect(metersNorth).toBeLessThan(51);
});

test("bounds cover every position", () => {
  expect(boundsOf([])).toBeNull();
  expect(
    boundsOf([
      [-89.62, 20.97],
      [-89.6, 20.98],
    ]),
  ).toEqual([
    [-89.62, 20.97],
    [-89.6, 20.98],
  ]);
});
