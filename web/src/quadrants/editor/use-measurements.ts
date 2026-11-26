import { useEffect, useState } from "react";
import type { GeoJSONStoreFeatures, TerraDraw } from "terra-draw";
import { DRAFT_FLAG } from "./draw-sync";
import { ringMeasures, segmentsOf } from "./measure";
import type { Segment } from "./measure";
import { DRAW_MODES } from "./terra-draw";

export interface MeasureLabel {
  id: string;
  at: [number, number];
  meters: number;
  /** The segment from the last corner to the cursor. */
  isLive: boolean;
  /** A ruler segment (throwaway), drawn with its own quiet look. */
  isRuler?: boolean;
}

export type MeasureSummary =
  | { kind: "quadrant" | "block"; isDrawing: boolean; perimeter: number; area: number }
  | { kind: "ruler"; isDrawing: boolean; total: number };

export interface Measurements {
  labels: MeasureLabel[];
  summary: MeasureSummary | null;
}

const NONE: Measurements = { labels: [], summary: null };
const DRAWING_MODES: readonly string[] = [DRAW_MODES.polygon, DRAW_MODES.block];

function ringOf(feature: GeoJSONStoreFeatures): number[][] {
  return feature.geometry.type === "Polygon" ? (feature.geometry.coordinates[0] ?? []) : [];
}

const labelOf = (id: string, item: Segment, isLive = false): MeasureLabel => ({
  id,
  at: item.middle,
  meters: item.meters,
  isLive,
});

/** The polygon being clicked: fixed sides, the live side to the cursor, and the closed shape. */
function measureDrawing(feature: GeoJSONStoreFeatures): Measurements {
  // An open ring ends with the closing position; the corner before it is the cursor.
  const path = ringOf(feature).slice(0, -1);
  const closed = ringMeasures(path);
  const labels = [
    ...segmentsOf(path.slice(0, -1)).map((item, index) => labelOf(`d${String(index)}`, item)),
    ...segmentsOf(path.slice(-2)).map((item) => labelOf("live", item, true)),
  ];
  const kind = feature.properties["mode"] === DRAW_MODES.block ? "block" : "quadrant";
  return { labels, summary: closed ? { kind, isDrawing: true, ...closed } : null };
}

/** The selected draft polygon: every side, perimeter and area. */
function measureSelected(feature: GeoJSONStoreFeatures): Measurements {
  const ring = ringOf(feature);
  const closed = ringMeasures(ring);
  const kind = feature.properties["kind"] === "block" ? "block" : "quadrant";
  return {
    labels: segmentsOf(ring).map((item, index) => labelOf(`s${String(index)}`, item)),
    summary: closed ? { kind, isDrawing: false, ...closed } : null,
  };
}

/**
 * Ruler lines: every segment of every line, and the running total of the line in progress
 * (or of the last one). While drawing, the last position of the line is the cursor.
 */
function measureRuler(draw: TerraDraw, lines: GeoJSONStoreFeatures[]): Measurements {
  const isDrawing = draw.getMode() === DRAW_MODES.ruler;
  const labels: MeasureLabel[] = [];
  let total = 0;
  lines.forEach((line, lineIndex) => {
    const path = line.geometry.type === "LineString" ? line.geometry.coordinates : [];
    const segments = segmentsOf(path);
    const live = Boolean(line.properties["currentlyDrawing"]);
    segments.forEach((item, index) => {
      labels.push({
        ...labelOf(
          `r${String(lineIndex)}-${String(index)}`,
          item,
          live && index === segments.length - 1,
        ),
        isRuler: true,
      });
    });
    total = segments.reduce((sum, item) => sum + item.meters, 0);
  });
  return { labels, summary: { kind: "ruler", isDrawing, total } };
}

/** What the map shows now: the ruler, the polygon being drawn, or the selected one. */
function measure(draw: TerraDraw): Measurements {
  const lines = draw
    .getSnapshot()
    .filter(
      (item) => item.properties["mode"] === DRAW_MODES.ruler && item.geometry.type === "LineString",
    );
  if (lines.length) return measureRuler(draw, lines);
  const polygons = draw.getSnapshot().filter((item) => item.geometry.type === "Polygon");
  const drawing = polygons.find(
    (item) =>
      typeof item.properties["mode"] === "string" &&
      DRAWING_MODES.includes(item.properties["mode"]) &&
      !item.properties[DRAFT_FLAG],
  );
  if (drawing) return measureDrawing(drawing);
  const selected = polygons.find(
    (item) => item.properties["selected"] === true && item.properties[DRAFT_FLAG] === true,
  );
  return selected ? measureSelected(selected) : NONE;
}

/** Lengths, perimeter and area of the shape being drawn or edited, refreshed once per frame. */
export function useMeasurements(draw: TerraDraw | null, revision = 0): Measurements {
  const [state, setState] = useState<Measurements>(NONE);
  useEffect(() => {
    if (!draw) return undefined;
    let frame = 0;
    const run = () => {
      frame = 0;
      const next = measure(draw);
      setState((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(run);
    };
    schedule();
    draw.on("change", schedule);
    draw.on("select", schedule);
    draw.on("deselect", schedule);
    draw.on("finish", schedule);
    return () => {
      draw.off("change", schedule);
      draw.off("select", schedule);
      draw.off("deselect", schedule);
      draw.off("finish", schedule);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [draw, revision]);
  return state;
}
