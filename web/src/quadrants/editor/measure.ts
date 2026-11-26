import type { TFunction } from "i18next";
import { polygonAreaKm2 } from "./geo-math";

/** WGS84 mean radius, the same value turf uses. */
const EARTH_RADIUS_M = 6_371_008.8;
const DEGREES = 180;
const KM = 1000;
const HECTARE_M2 = 10_000;
const SQUARE_METERS_PER_KM2 = 1_000_000;
const MIN_RING_POINTS = 3;
const TINY_METERS = 10;

type Position = readonly number[];

const radians = (value: number) => (value * Math.PI) / DEGREES;

/** Haversine distance in meters between two [lon, lat] positions. */
export function distanceM(from: Position, to: Position): number {
  const [lon1 = 0, lat1 = 0] = from;
  const [lon2 = 0, lat2 = 0] = to;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** One side of a shape: its length and the point where its label sits. */
export interface Segment {
  meters: number;
  middle: [number, number];
}

/** Open path to its segments; repeated points (zero length) are skipped. */
export function segmentsOf(path: readonly Position[]): Segment[] {
  const result: Segment[] = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const from = path[index];
    const to = path[index + 1];
    if (!from || !to) continue;
    const meters = distanceM(from, to);
    if (meters === 0) continue;
    result.push({
      meters,
      middle: [((from[0] ?? 0) + (to[0] ?? 0)) / 2, ((from[1] ?? 0) + (to[1] ?? 0)) / 2],
    });
  }
  return result;
}

/** Ring without its repeated closing position. */
export function openRing(ring: readonly Position[]): Position[] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return ring.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]
    ? ring.slice(0, -1)
    : [...ring];
}

/** Perimeter (m) and area (m²) of the shape the open path would close into. */
export function ringMeasures(path: readonly Position[]) {
  const points = openRing(path);
  if (points.length < MIN_RING_POINTS) return null;
  const closed = [...points, points[0] as Position];
  const perimeter = segmentsOf(closed).reduce((sum, item) => sum + item.meters, 0);
  const area =
    polygonAreaKm2({
      type: "Polygon",
      coordinates: [closed.map((item) => [...item])],
    }) * SQUARE_METERS_PER_KM2;
  return { perimeter, area };
}

const formatted = (language: string, value: number, decimals: number) =>
  new Intl.NumberFormat(language, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);

/** "48 m", or "1.2 km" from 1000 m, with the number format of the language. */
export function lengthText(t: TFunction, language: string, meters: number): string {
  return meters >= KM
    ? t("mapEditor.measure.km", { value: formatted(language, meters / KM, 2) })
    : t("mapEditor.measure.m", {
        value: formatted(language, meters, meters < TINY_METERS ? 1 : 0),
      });
}

/** m², or hectares (with the m² in brackets) from 10,000 m². */
export function areaText(t: TFunction, language: string, squareMeters: number): string {
  const plain = t("mapEditor.measure.m2", { value: formatted(language, squareMeters, 0) });
  if (squareMeters < HECTARE_M2) return plain;
  const hectares = t("mapEditor.measure.ha", {
    value: formatted(language, squareMeters / HECTARE_M2, 2),
  });
  return t("mapEditor.measure.areaBoth", { big: hectares, small: plain });
}
