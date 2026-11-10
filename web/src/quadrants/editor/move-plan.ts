/* eslint-disable max-lines-per-function, complexity, max-depth, max-params -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import type { Schemas } from "@wolbachia/api-client";
import { containsLocation } from "../geography/geometry";
import type { Polygon } from "../geography/geometry";
import type { EditTarget, PointKind } from "./editor-model";

export type OutsideDecision = "" | "keep" | "remove";

export interface OutsidePoint {
  featureId: string;
  point: Schemas["SamplingPoint"];
  movedTo: number[] | null;
}

export interface PointMove {
  featureId: string;
  kind: PointKind;
  recordId: string;
  revision: number;
  location: number[];
}

export interface MovePlan {
  quadrant: EditTarget | null;
  polygonChanged: boolean;
  outside: OutsidePoint[];
  moves: PointMove[];
}

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** What saving the move tool would publish: one quadrant version, then single point moves. */
export function buildMovePlan(
  targets: ReadonlyMap<string, EditTarget>,
  polygon: Polygon | null,
  moved: Readonly<Record<string, number[]>>,
  points: readonly Schemas["SamplingPoint"][],
): MovePlan {
  const entries = [...targets.entries()];
  const quadrant = entries.find(([, target]) => target.kind === "quadrant")?.[1] ?? null;
  const polygonChanged = Boolean(quadrant && polygon && !same(polygon, quadrant.original));
  const outside: OutsidePoint[] = [];
  const moves: PointMove[] = [];
  for (const [featureId, target] of entries) {
    if (target.kind === "quadrant") continue;
    const original = target.original as number[];
    const movedTo = moved[featureId] ?? null;
    const isOutside =
      target.kind === "sampling" &&
      polygonChanged &&
      polygon &&
      !containsLocation(polygon, original);
    if (isOutside) {
      const point = points.find((item) => item.id === target.recordId);
      const inside = movedTo && containsLocation(polygon, movedTo) ? movedTo : null;
      if (point) outside.push({ featureId, point, movedTo: inside });
      continue;
    }
    if (movedTo && !same(movedTo, original))
      moves.push({
        featureId,
        kind: target.kind,
        recordId: target.recordId,
        revision: target.revision,
        location: movedTo,
      });
  }
  return { quadrant, polygonChanged, outside, moves };
}
