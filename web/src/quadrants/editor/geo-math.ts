import type { Polygon } from "../geography/geometry";
import { containsLocation } from "../geography/geometry";

const EARTH_RADIUS_M = 6_371_008.8;
const SQUARE_METERS_PER_KM2 = 1_000_000;
const DEGREES = 180;
const COORDINATE_DECIMALS = 7;

function toRadians(value: number): number {
  return (value * Math.PI) / DEGREES;
}

/** Spherical ring area (m²), same approach as common GIS libraries. */
function ringArea(ring: readonly number[][]): number {
  let total = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [lon1 = 0, lat1 = 0] = ring[index] ?? [];
    const [lon2 = 0, lat2 = 0] = ring[index + 1] ?? [];
    total += toRadians(lon2 - lon1) * (2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** Outer ring minus holes, in km². */
export function polygonAreaKm2(polygon: Polygon): number {
  const [outer = [], ...holes] = polygon.coordinates;
  const area = holes.reduce((sum, hole) => sum - ringArea(hole), ringArea(outer));
  return Math.max(area, 0) / SQUARE_METERS_PER_KM2;
}

export function roundPosition(position: readonly number[]): number[] {
  return position.slice(0, 2).map((value) => Number(value.toFixed(COORDINATE_DECIMALS)));
}

export function roundPolygon(polygon: Polygon): Polygon {
  return {
    type: "Polygon",
    coordinates: polygon.coordinates.map((ring) => ring.map(roundPosition)),
  };
}

/** Accepts unknown GeoJSON (permit zones): Polygon or MultiPolygon. */
export function zoneContains(zone: unknown, location: number[]): boolean {
  if (!zone || typeof zone !== "object") return false;
  const { type, coordinates } = zone as { type?: unknown; coordinates?: unknown };
  if (!Array.isArray(coordinates)) return false;
  if (type === "Polygon")
    return containsLocation(
      { type: "Polygon", coordinates: coordinates as number[][][] },
      location,
    );
  if (type === "MultiPolygon")
    return (coordinates as number[][][][]).some((part) =>
      containsLocation({ type: "Polygon", coordinates: part }, location),
    );
  return false;
}

export function centroid(polygon: Polygon): [number, number] {
  const ring = polygon.coordinates[0] ?? [];
  const vertices = ring.length > 1 ? ring.slice(0, -1) : ring;
  const count = Math.max(vertices.length, 1);
  let longitude = 0;
  let latitude = 0;
  for (const [lon = 0, lat = 0] of vertices) {
    longitude += lon;
    latitude += lat;
  }
  return [longitude / count, latitude / count];
}
