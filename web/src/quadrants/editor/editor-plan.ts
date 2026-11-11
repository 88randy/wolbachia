/* eslint-disable max-lines-per-function, complexity, max-depth -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { containsLocation } from "../geography/geometry";
import type { Polygon } from "../geography/geometry";
import type { EditorData } from "./use-editor-data";
import type { DraftShape } from "./editor-draft";
import { isChanged } from "./editor-draft";
import {
  blocksOf,
  holdingBlock,
  holdingQuadrant,
  locationOf,
  polygonOf,
  vertices,
} from "./editor-places";
import type { Ref } from "./editor-places";

export type { Ref } from "./editor-places";
export type OutsideDecision = "" | "keep" | "remove";

/** A sampling point that no longer fits inside a reshaped quadrant. */
export interface OutsidePoint {
  quadrantKey: string;
  point: Schemas["SamplingPoint"];
  /** Where the user dragged it, when that spot is inside the new shape. */
  movedTo: number[] | null;
}

const isNewQuadrant = (shape: DraftShape) => shape.kind === "quadrant" && !shape.saved;

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

/**
 * A point outside every block falls back to one automatic block, only inside a new quadrant
 * that has no blocks of its own yet.
 */
export function autoBlockOwner(
  data: EditorData,
  shapes: readonly DraftShape[],
  location: number[],
) {
  const owner = holdingQuadrant(data, shapes, [location]);
  if (!owner || !("key" in owner.ref)) return undefined;
  return blocksOf(data, shapes, owner).length === 0 ? owner : undefined;
}

const existingCodes = (kind: DraftShape["kind"], data: EditorData) =>
  kind === "quadrant"
    ? data.quadrants.map((item) => item.code)
    : kind === "block"
      ? data.blocks.map((item) => item.code)
      : kind === "sampling"
        ? data.points.map((item) => item.code)
        : data.releasePoints.map((item) => item.code);

function placeIssue(data: EditorData, shapes: readonly DraftShape[], shape: DraftShape) {
  if (shape.kind === "block")
    return holdingQuadrant(data, shapes, vertices(polygonOf(shape)))
      ? undefined
      : "mapEditor.issue.blockOutside";
  if (shape.kind === "sampling") {
    const place = locationOf(shape);
    return holdingBlock(data, shapes, place) || autoBlockOwner(data, shapes, place)
      ? undefined
      : "mapEditor.point.needBlock";
  }
  if (shape.kind === "release")
    return holdingQuadrant(data, shapes, [locationOf(shape)])
      ? undefined
      : "mapEditor.point.needQuadrant";
  return undefined;
}

/** What stops a draft item from being saved, in plain words. One entry per shape key. */
export function shapeIssues(data: EditorData, shapes: readonly DraftShape[]) {
  const issues = new Map<string, MessageKey>();
  const taken = (shape: DraftShape) => {
    const wanted = shape.code.trim().toLowerCase();
    return (
      existingCodes(shape.kind, data).some((item) => item.toLowerCase() === wanted) ||
      shapes.some(
        (item) =>
          item.key !== shape.key &&
          item.kind === shape.kind &&
          !item.saved &&
          item.code.trim().toLowerCase() === wanted,
      )
    );
  };
  for (const shape of shapes) {
    if (shape.saved && !(shape.kind === "block" && isChanged(shape))) continue;
    if (!shape.saved && !shape.code.trim()) issues.set(shape.key, "mapEditor.issue.code");
    else if (!shape.saved && taken(shape)) issues.set(shape.key, "mapEditor.error.duplicateCode");
    else if (shape.kind === "quadrant" && !shape.saved && !shape.centerId)
      issues.set(shape.key, "mapEditor.issue.center");
    else {
      const issue = placeIssue(data, shapes, shape);
      if (issue) issues.set(shape.key, issue);
    }
  }
  return issues;
}

export type PlanStep =
  | { type: "quadrant"; key: string; code: string; center: string; polygon: Polygon }
  | { type: "block"; key: string; code: string; polygon: Polygon; parent: Ref }
  | { type: "blockVersion"; key: string; recordId: string; revision: number; polygon: Polygon }
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

/** Draft shapes a step needs saved first. */
export function dependsOn(step: PlanStep): string | null {
  if (!("parent" in step)) return null;
  return "key" in step.parent ? step.parent.key : null;
}

export interface PlanInput {
  data: EditorData;
  shapes: readonly DraftShape[];
  decisions: Readonly<Record<string, OutsideDecision>>;
  reason: string;
}

function versionStep(shape: DraftShape, input: PlanInput, outside: OutsidePoint[]): PlanStep {
  const saved = shape.saved as NonNullable<DraftShape["saved"]>;
  const mine = outside.filter((item) => item.quadrantKey === shape.key);
  const reshaped = new Set(mine.map((item) => item.point.id));
  return {
    type: "version",
    key: shape.key,
    recordId: saved.recordId,
    revision: saved.revision,
    polygon: polygonOf(shape),
    resolutions: mine.map<Schemas["PointResolutionRequest"]>((item) =>
      item.movedTo
        ? { point: item.point.id, decision: "move", evidence: input.reason, location: item.movedTo }
        : {
            point: item.point.id,
            decision: input.decisions[item.point.id] || "keep",
            evidence: input.reason,
          },
    ),
    covers: input.shapes
      .filter((item) => item.kind === "sampling" && item.saved && reshaped.has(item.saved.recordId))
      .map((item) => item.key),
  };
}

/** Writes in a safe order: quadrants, then blocks, then points, then moves. */
export function buildPlan(input: PlanInput): PlanStep[] {
  const { data, shapes } = input;
  const changed = shapes.filter(isChanged);
  const outside = outsidePoints(data, shapes);
  const consumed = new Set(outside.filter((item) => item.movedTo).map((item) => item.point.id));
  const steps: PlanStep[] = [];
  const newSampling = changed.filter((item) => item.kind === "sampling" && !item.saved);
  const autoOwners = new Map<string, { code: string; polygon: Polygon }>();
  for (const shape of newSampling) {
    const place = locationOf(shape);
    const owner = holdingBlock(data, shapes, place)
      ? undefined
      : autoBlockOwner(data, shapes, place);
    if (owner && "key" in owner.ref) autoOwners.set(owner.ref.key, owner);
  }
  for (const shape of changed.filter(isNewQuadrant))
    steps.push({
      type: "quadrant",
      key: shape.key,
      code: shape.code.trim(),
      center: shape.centerId,
      polygon: polygonOf(shape),
    });
  for (const shape of changed.filter((item) => item.kind === "quadrant" && item.saved))
    steps.push(versionStep(shape, input, outside));
  for (const shape of changed.filter((item) => item.kind === "block")) {
    const saved = shape.saved;
    if (saved)
      steps.push({
        type: "blockVersion",
        key: shape.key,
        recordId: saved.recordId,
        revision: saved.revision,
        polygon: polygonOf(shape),
      });
    else {
      const parent = holdingQuadrant(data, shapes, vertices(polygonOf(shape)));
      if (parent)
        steps.push({
          type: "block",
          key: shape.key,
          code: shape.code.trim(),
          polygon: polygonOf(shape),
          parent: parent.ref,
        });
    }
  }
  for (const [quadrantKey, owner] of autoOwners)
    steps.push({
      type: "block",
      key: `${quadrantKey}:auto`,
      code: `${owner.code.trim()}-M1`,
      polygon: owner.polygon,
      parent: { key: quadrantKey },
    });
  for (const shape of newSampling) {
    const place = locationOf(shape);
    const block = holdingBlock(data, shapes, place);
    const owner = block ? undefined : autoBlockOwner(data, shapes, place);
    const parent: Ref | null = block
      ? block.ref
      : owner && "key" in owner.ref
        ? { key: `${owner.ref.key}:auto` }
        : null;
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
    const quadrant = holdingQuadrant(data, shapes, [place]);
    if (quadrant)
      steps.push({
        type: "release",
        key: shape.key,
        code: shape.code.trim(),
        location: place,
        parent: quadrant.ref,
      });
  }
  for (const shape of changed.filter(
    (item) => item.saved && (item.kind === "sampling" || item.kind === "release"),
  )) {
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
