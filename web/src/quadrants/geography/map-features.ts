import type { MapProps } from "./map-types";
import type { MapSource } from "./map-source";
import type { StyleSpecification } from "maplibre-gl";
import type { Polygon } from "./geometry";
import { spacing } from "@wolbachia/tokens";
import { MAX_MAP_ZOOM } from "./map-source";
export function centerPattern(center: string): "solid" | "dashed" {
  return Array.from(new TextEncoder().encode(center)).reduce(
    (total, character) => total + character,
    0,
  ) % 2
    ? "dashed"
    : "solid";
}
function polygonFeature(
  item: { code: string; center?: string; current_version: { geometry: Polygon } | null },
  kind: string,
) {
  if (!item.current_version) return [];
  const center = item.center ?? "";
  return [
    {
      type: "Feature" as const,
      properties: { code: item.code, kind, center, pattern: centerPattern(center) },
      geometry: item.current_version.geometry,
    },
  ];
}
/** Only the requested page/record is drawn; it never stands for the full organization. */
export function mapFeatures({ quadrants, blocks = [], points = [], draft }: MapProps) {
  const polygonFeatures = [
    ...quadrants.flatMap((item) => polygonFeature(item, "quadrant")),
    ...blocks.flatMap((item) => polygonFeature(item, "block")),
  ];
  if (draft)
    polygonFeatures.push(
      ...polygonFeature({ code: "", current_version: { geometry: draft } }, "draft"),
    );
  const pointFeatures = points.flatMap((item) =>
    item.current_version
      ? [
          {
            type: "Feature" as const,
            properties: { code: item.code, isRetired: item.current_version.is_retired },
            geometry: { type: "Point" as const, coordinates: item.current_version.location },
          },
        ]
      : [],
  );
  return {
    polygons: { type: "FeatureCollection" as const, features: polygonFeatures },
    points: { type: "FeatureCollection" as const, features: pointFeatures },
  };
}
export function baseMapStyle(source: MapSource): string | StyleSpecification {
  if (!source.isRaster) return source.url;
  const TILE_SIZE = 256;
  return {
    version: 8,
    sources: {
      base: { type: "raster", tiles: [source.url], tileSize: TILE_SIZE, maxzoom: MAX_MAP_ZOOM },
    },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
}
export function initialMapView(props: MapProps) {
  const vertices = props.quadrants.flatMap(
    (item) => item.current_version?.geometry.coordinates[0] ?? [],
  );
  if (!vertices.length) return { longitude: 0, latitude: 0, zoom: 1 };
  const longitudes = vertices.map((point) => Number(point[0]));
  const latitudes = vertices.map((point) => Number(point[1]));
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
  return { bounds, fitBoundsOptions: { padding: spacing[3] } };
}
