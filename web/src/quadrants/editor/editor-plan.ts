/* eslint-disable max-lines-per-function, complexity, max-depth -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { containsLocation } from "../geography/geometry";
import type { Polygon } from "../geography/geometry";
import type { EditorData } from "./use-editor-data";
import type { DraftShape, PointGeometry } from "./editor-draft";
import { isChanged } from "./editor-draft";
import { blockAt, quadrantAt } from "./editor-model";

export type OutsideDecision = "" | "keep" | "remove";

/** A sampling point that no longer fits inside a reshaped quadrant. */
export interface OutsidePoint {
  quadrantKey: string;
  point: Schemas["SamplingPoint"];
  /** Where the user dragged it, when that spot is inside the new shape. */
  movedTo: number[] | null;
}

const polygonOf = (shape: DraftShape) => shape.geometry as Polygon;
const locationOf = (shape: DraftShape) => (shape.geometry as PointGeometry).coordinates;
const isNewQuadrant = (shape: DraftShape) => shape.kind === "quadrant" && !shape.saved;

/** The new quadrant (still unsaved) that holds a location, if any. */
function draftQuadrantAt(shapes: readonly DraftShape[], location: number[]) {
  return shapes.find((item) => isNewQuadrant(item) && containsLocation(polygonOf(item), location));
}

/** Points of a reshaped quadrant whose saved place falls outside the new shape. */
export function outsidePoints(data: EditorData, shapes: readonly DraftShape[]): OutsidePoint[] {
  const result: OutsidePoint[] = [];
  for (const quadrant of shapes) {
    if (quadrant.kind !== "quadrant" || !quadrant.saved || !isChanged(quadrant)) continue;
    const polygon = polygonOf(quadrant);
    const blockIds = new Set(
      data.blocks.filter((item) => item.quadrant === quadrant.saved?.recordId).map((i) => i.id),
    );
    for (const point of data.points) {
      const version = point.current_version;
      if (!blockIds.has(point.block) || !version || containsLocation(polygon, version.location))
        continue;
      const moved = shapes.find(
        (item) => item.kind === "sampling" && item.saved?.recordId === point.id,
      );
      const movedTo =
        moved && containsLocation(polygon, locationOf(moved)) ? locationOf(moved) : null;
      result.push({ quadrantKey: quadrant.key, point, movedTo });
    }
  }
  return result;
}

/** What stops a draft item from being saved, in plain words. One entry per shape key. */
export function shapeIssues(data: EditorData, shapes: readonly DraftShape[]) {
  const issues = new Map<string, MessageKey>();
  const taken = (kind: DraftShape["kind"], code: string, key: string) => {
    const wanted = code.trim().toLowerCase();
    const existing =
      kind === "quadrant"
        ? data.quadrants.map((item) => item.code)
        : kind === "sampling"
          ? data.points.map((item) => item.code)
          : data.releasePoints.map((item) => item.code);
    return (
      existing.some((item) => item.toLowerCase() === wanted) ||
      shapes.some(
        (item) =>
          item.key !== key &&
          item.kind === kind &&
          !item.saved &&
          item.code.trim().toLowerCase() === wanted,
      )
    );
  };
  for (const shape of shapes) {
    if (shape.saved) continue;
    if (!shape.code.trim()) issues.set(shape.key, "mapEditor.issue.code");
    else if (taken(shape.kind, shape.code, shape.key))
      issues.set(shape.key, "mapEditor.error.duplicateCode");
    else if (shape.kind === "quadrant" && !shape.centerId)
      issues.set(shape.key, "mapEditor.issue.center");
    else if (shape.kind === "sampling") {
      const place = locationOf(shape);
      if (!blockAt(data.blocks, place) && !draftQuadrantAt(shapes, place))
        issues.set(shape.key, "mapEditor.point.needBlock");
    } else if (shape.kind === "release") {
      const place = locationOf(shape);
      if (!quadrantAt(data.quadrants, place) && !draftQuadrantAt(shapes, place))
        issues.set(shape.key, "mapEditor.point.needQuadrant");
    }
  }
  return issues;
}

export type Ref = { id: string } | { quadrantKey: string };

export type PlanStep =
  | { type: "quadrant"; key: string; code: string; center: string; polygon: Polygon }
  | { type: "block"; key: string; quadrantKey: string; code: string; polygon: Polygon }
  | {
      type: "version";
      key: string;
      recordId: string;
      revision: number;
      polygon: Polygon;
      resolutions: Schemas["PointResolutionRequest"][];
      /** Dragged points that this write settles (they leave the draft with it). */
      covers: string[];
    }
  | { type: "sampling"; key: string; code: string; location: number[]; parent: Ref }
  | { type: "release"; key: string; code: string; location: number[]; parent: Ref }
  | {
      type: "move";
      key: string;
      kind: "sampling" | "release";
      recordId: string;
      revision: number;
      location: number[];
    };

export interface PlanInput {
  data: EditorData;
  shapes: readonly DraftShape[];
  decisions: Readonly<Record<string, OutsideDecision>>;
  reason: string;
}

/** Writes in a safe order: new quadrants, their blocks, reshaped quadrants, new points, moves. */
export function buildPlan({ data, shapes, decisions, reason }: PlanInput): PlanStep[] {
  const changed = shapes.filter(isChanged);
  const outside = outsidePoints(data, shapes);
  const consumed = new Set(outside.filter((item) => item.movedTo).map((item) => item.point.id));
  const steps: PlanStep[] = [];
  const blockFor = new Set<string>();
  for (const shape of changed) {
    if (shape.kind === "sampling" && !shape.saved && !blockAt(data.blocks, locationOf(shape))) {
      const owner = draftQuadrantAt(shapes, locationOf(shape));
      if (owner) blockFor.add(owner.key);
    }
  }
  for (const shape of changed.filter(isNewQuadrant)) {
    steps.push({
      type: "quadrant",
      key: shape.key,
      code: shape.code.trim(),
      center: shape.centerId,
      polygon: polygonOf(shape),
    });
    if (blockFor.has(shape.key))
      steps.push({
        type: "block",
        key: `${shape.key}:block`,
        quadrantKey: shape.key,
        code: `${shape.code.trim()}-M1`,
        polygon: polygonOf(shape),
      });
  }
  for (const shape of changed.filter((item) => item.kind === "quadrant" && item.saved)) {
    const saved = shape.saved;
    if (!saved) continue;
    const resolutions = outside
      .filter((item) => item.quadrantKey === shape.key)
      .map<Schemas["PointResolutionRequest"]>((item) =>
        item.movedTo
          ? { point: item.point.id, decision: "move", evidence: reason, location: item.movedTo }
          : {
              point: item.point.id,
              decision: decisions[item.point.id] || "keep",
              evidence: reason,
            },
      );
    const reshaped = new Set(
      outside.filter((item) => item.quadrantKey === shape.key).map((item) => item.point.id),
    );
    const covers = shapes
      .filter((item) => item.kind === "sampling" && item.saved && reshaped.has(item.saved.recordId))
      .map((item) => item.key);
    steps.push({
      type: "version",
      key: shape.key,
      recordId: saved.recordId,
      revision: saved.revision,
      polygon: polygonOf(shape),
      resolutions,
      covers,
    });
  }
  for (const shape of changed.filter((item) => !item.saved && item.kind === "sampling")) {
    const place = locationOf(shape);
    const block = blockAt(data.blocks, place);
    const owner = draftQuadrantAt(shapes, place);
    const parent: Ref | null = block ? { id: block.id } : owner ? { quadrantKey: owner.key } : null;
    if (parent)
      steps.push({
        type: "sampling",
        key: shape.key,
        code: shape.code.trim(),
        location: place,
        parent,
      });
  }
  for (const shape of changed.filter((item) => !item.saved && item.kind === "release")) {
    const place = locationOf(shape);
    const quadrant = quadrantAt(data.quadrants, place);
    const owner = draftQuadrantAt(shapes, place);
    const parent: Ref | null = quadrant
      ? { id: quadrant.id }
      : owner
        ? { quadrantKey: owner.key }
        : null;
    if (parent)
      steps.push({
        type: "release",
        key: shape.key,
        code: shape.code.trim(),
        location: place,
        parent,
      });
  }
  for (const shape of changed.filter((item) => item.saved && item.kind !== "quadrant")) {
    const saved = shape.saved;
    if (!saved || consumed.has(saved.recordId)) continue;
    if (outside.some((item) => item.point.id === saved.recordId)) continue;
    steps.push({
      type: "move",
      key: shape.key,
      kind: shape.kind as "sampling" | "release",
      recordId: saved.recordId,
      revision: saved.revision,
      location: locationOf(shape),
    });
  }
  return steps;
}
