import { containsLocation } from "../geography/geometry";
import type { Polygon } from "../geography/geometry";
import type { EditorData } from "./use-editor-data";
import type { DraftShape, PointGeometry } from "./editor-draft";
import { geometryOf } from "./editor-model";

/** A saved record (by id) or a draft shape that is saved first (by its key). */
export type Ref = { id: string } | { key: string };

export interface Place {
  ref: Ref;
  code: string;
  polygon: Polygon;
}

export const polygonOf = (shape: DraftShape) => shape.geometry as Polygon;
export const locationOf = (shape: DraftShape) => (shape.geometry as PointGeometry).coordinates;

/** One position that stands for a polygon (first corner set is enough for the check below). */
export function vertices(polygon: Polygon): number[][] {
  return (polygon.coordinates[0] ?? []).slice(0, -1);
}

function places(
  kind: "quadrant" | "block",
  data: EditorData,
  shapes: readonly DraftShape[],
): Place[] {
  const saved = kind === "quadrant" ? data.quadrants : data.blocks;
  // A saved record that is in the draft is represented by its draft shape (new geometry).
  const drafted = new Set(shapes.flatMap((item) => (item.saved ? [item.saved.recordId] : [])));
  return [
    ...shapes
      .filter((item) => item.kind === kind)
      .map<Place>((item) => ({
        ref: item.saved ? { id: item.saved.recordId } : { key: item.key },
        code: item.saved?.code ?? item.code,
        polygon: polygonOf(item),
      })),
    ...saved.flatMap<Place>((item) => {
      const geometry = geometryOf(item);
      return geometry && !drafted.has(item.id)
        ? [{ ref: { id: item.id }, code: item.code, polygon: geometry }]
        : [];
    }),
  ];
}

/** The quadrant (saved or drafted) that holds every given position. */
export function holdingQuadrant(
  data: EditorData,
  shapes: readonly DraftShape[],
  positions: number[][],
): Place | undefined {
  return places("quadrant", data, shapes).find((item) =>
    positions.every((point) => containsLocation(item.polygon, point)),
  );
}

/** The block (saved or drafted) that holds a location. */
export function holdingBlock(
  data: EditorData,
  shapes: readonly DraftShape[],
  location: number[],
): Place | undefined {
  return places("block", data, shapes).find((item) => containsLocation(item.polygon, location));
}

/** Blocks (saved or drafted) that sit inside a quadrant place. */
export function blocksOf(
  data: EditorData,
  shapes: readonly DraftShape[],
  quadrant: Place,
): Place[] {
  return places("block", data, shapes).filter((item) =>
    vertices(item.polygon).every((point) => containsLocation(quadrant.polygon, point)),
  );
}
