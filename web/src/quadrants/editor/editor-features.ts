/* eslint-disable max-lines-per-function, max-params -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import type { Schemas } from "@wolbachia/api-client";
import { centerPatterns, geometryOf } from "./editor-model";

interface Hidden {
  /** Saved records the draft draws itself (Terra Draw), so the static layer skips them. */
  recordIds: ReadonlySet<string>;
}

/** Static (read-only) layers; the quadrant being edited is drawn by Terra Draw instead. */
export function editorFeatures(
  data: {
    quadrants: readonly Schemas["Quadrant"][];
    blocks: readonly Schemas["Block"][];
    points: readonly Schemas["SamplingPoint"][];
    releasePoints: readonly Schemas["ReleasePoint"][];
  },
  hidden: Hidden,
) {
  const centerOf = new Map(data.quadrants.map((item) => [item.id, item.center]));
  const centerPattern = centerPatterns(data.quadrants);
  const polygons = [
    ...data.quadrants.flatMap((item) => {
      const geometry = geometryOf(item);
      if (!geometry || hidden.recordIds.has(item.id)) return [];
      return [
        {
          type: "Feature" as const,
          id: item.id,
          properties: {
            id: item.id,
            code: item.code,
            kind: "quadrant",
            pattern: centerPattern(item.center),
          },
          geometry,
        },
      ];
    }),
    ...data.blocks.flatMap((item) => {
      const geometry = geometryOf(item);
      if (!geometry || hidden.recordIds.has(item.id)) return [];
      return [
        {
          type: "Feature" as const,
          properties: {
            id: item.id,
            code: item.code,
            kind: "block",
            pattern: centerPattern(centerOf.get(item.quadrant) ?? ""),
          },
          geometry,
        },
      ];
    }),
  ];
  const pointFeature = (id: string, code: string, kind: string, location: number[]) => ({
    type: "Feature" as const,
    properties: { id, code, kind },
    geometry: { type: "Point" as const, coordinates: location },
  });
  const points = [
    ...data.points.flatMap((item) =>
      item.current_version && !hidden.recordIds.has(item.id)
        ? [pointFeature(item.id, item.code, "sampling", item.current_version.location)]
        : [],
    ),
    ...data.releasePoints.flatMap((item) =>
      item.current_version && !hidden.recordIds.has(item.id)
        ? [pointFeature(item.id, item.code, "release", item.current_version.location)]
        : [],
    ),
  ];
  return {
    polygons: { type: "FeatureCollection" as const, features: polygons },
    points: { type: "FeatureCollection" as const, features: points },
  };
}

/** Fits the outlines of any quadrant shape: full records or the codes-and-outlines lookup. */
export function initialView(quadrants: readonly Parameters<typeof geometryOf>[0][]) {
  const vertices = quadrants.flatMap((item) => geometryOf(item)?.coordinates[0] ?? []);
  if (!vertices.length) return { longitude: -89.62, latitude: 20.97, zoom: 12 };
  const longitudes = vertices.map((point) => Number(point[0]));
  const latitudes = vertices.map((point) => Number(point[1]));
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
  return { bounds, fitBoundsOptions: { padding: 48 } };
}

/** Bounds of every quadrant plus the shapes of the draft, or null when the map is empty. */
export function shapeBounds(
  quadrants: readonly Schemas["Quadrant"][],
  shapes: readonly { geometry: { type: string; coordinates: unknown } }[],
): [[number, number], [number, number]] | null {
  const positions: number[][] = [
    ...quadrants.flatMap((item) => geometryOf(item)?.coordinates[0] ?? []),
    ...shapes.flatMap((item) =>
      item.geometry.type === "Polygon"
        ? ((item.geometry.coordinates as number[][][])[0] ?? [])
        : [item.geometry.coordinates as number[]],
    ),
  ];
  if (!positions.length) return null;
  const longitudes = positions.map((point) => Number(point[0]));
  const latitudes = positions.map((point) => Number(point[1]));
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}
