import type { GeoJSONStoreFeatures, TerraDraw } from "terra-draw";
import { roundPolygon, roundPosition } from "./geo-math";
import type { DraftShape, ShapeGeometry } from "./editor-draft";
import { DRAW_MODES } from "./terra-draw";

/** Marks the Terra Draw features that belong to the draft (the rest are drawing helpers). */
export const DRAFT_FLAG = "draft";

export function featureOf(shape: DraftShape): GeoJSONStoreFeatures {
  return {
    id: shape.key,
    type: "Feature",
    geometry: shape.geometry,
    properties: {
      mode: shape.kind === "quadrant" ? DRAW_MODES.polygon : DRAW_MODES.point,
      kind: shape.kind,
      [DRAFT_FLAG]: true,
    },
  };
}

/** Round a Terra Draw geometry to the precision the API stores. */
export function roundedGeometry(geometry: GeoJSONStoreFeatures["geometry"]): ShapeGeometry | null {
  if (geometry.type === "Polygon")
    return roundPolygon({ type: "Polygon", coordinates: geometry.coordinates });
  if (geometry.type === "Point")
    return { type: "Point", coordinates: roundPosition(geometry.coordinates) };
  return null;
}

/**
 * Make the Terra Draw store match the draft (after undo, redo, remove or load).
 * Drawing helpers such as an unfinished polygon are never touched.
 */
export function syncDraw(draw: TerraDraw, shapes: readonly DraftShape[]): void {
  const current = new Map(
    draw
      .getSnapshot()
      .filter((feature) => feature.properties[DRAFT_FLAG] === true)
      .map((feature) => [String(feature.id), feature] as const),
  );
  const wanted = new Set(shapes.map((shape) => shape.key));
  const stale = [...current.keys()].filter((key) => !wanted.has(key));
  if (stale.length) draw.removeFeatures(stale);
  const missing: GeoJSONStoreFeatures[] = [];
  for (const shape of shapes) {
    const feature = current.get(shape.key);
    if (!feature) {
      missing.push(featureOf(shape));
      continue;
    }
    const geometry = roundedGeometry(feature.geometry);
    if (JSON.stringify(geometry) !== JSON.stringify(shape.geometry))
      draw.updateFeatureGeometry(shape.key, shape.geometry);
  }
  if (missing.length) draw.addFeatures(missing);
}
