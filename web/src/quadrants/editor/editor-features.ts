/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import type { Schemas } from "@wolbachia/api-client";
import { centerPattern } from "../geography/map-features";
import { geometryOf } from "./editor-model";

interface Hidden {
  quadrant: string | null;
  blockIds: ReadonlySet<string>;
}

/** Static (read-only) layers; the quadrant being edited is drawn by Terra Draw instead. */
export function editorFeatures(
  data: {
    quadrants: readonly Schemas["Quadrant"][];
    blocks: readonly Schemas["Block"][];
    points: readonly Schemas["SamplingPoint"][];
    releasePoints: readonly Schemas["ReleasePoint"][];
  },
  selected: string | null,
  hidden: Hidden,
) {
  const centerOf = new Map(data.quadrants.map((item) => [item.id, item.center]));
  const polygons = [
    ...data.quadrants.flatMap((item) => {
      const geometry = geometryOf(item);
      if (!geometry || item.id === hidden.quadrant) return [];
      return [
        {
          type: "Feature" as const,
          id: item.id,
          properties: {
            id: item.id,
            code: item.code,
            kind: "quadrant",
            pattern: centerPattern(item.center),
            selected: item.id === selected,
          },
          geometry,
        },
      ];
    }),
    ...data.blocks.flatMap((item) => {
      const geometry = geometryOf(item);
      if (!geometry) return [];
      return [
        {
          type: "Feature" as const,
          properties: {
            id: item.id,
            code: item.code,
            kind: "block",
            pattern: centerPattern(centerOf.get(item.quadrant) ?? ""),
            selected: false,
          },
          geometry,
        },
      ];
    }),
  ];
  const pointFeature = (code: string, kind: string, location: number[]) => ({
    type: "Feature" as const,
    properties: { code, kind },
    geometry: { type: "Point" as const, coordinates: location },
  });
  const points = [
    ...data.points.flatMap((item) =>
      item.current_version && !hidden.blockIds.has(item.block)
        ? [pointFeature(item.code, "sampling", item.current_version.location)]
        : [],
    ),
    ...data.releasePoints.flatMap((item) =>
      item.current_version && item.quadrant !== hidden.quadrant
        ? [pointFeature(item.code, "release", item.current_version.location)]
        : [],
    ),
  ];
  return {
    polygons: { type: "FeatureCollection" as const, features: polygons },
    points: { type: "FeatureCollection" as const, features: points },
  };
}

export function initialView(quadrants: readonly Schemas["Quadrant"][]) {
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
