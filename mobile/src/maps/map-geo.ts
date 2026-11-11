import type { InitialViewState } from "@maplibre/maplibre-react-native";
import { DEMO_CENTER, DEMO_ZOOM } from "./map-types.ts";
import type { LngLatPair, MapPoint, MapZone } from "./map-types.ts";

/** West, south, east, north. */
export type Bounds = readonly [number, number, number, number];

/** Bounds covering every point and zone vertex, or null when there is nothing to show. */
export function boundsOf(points: readonly MapPoint[], zones: readonly MapZone[]): Bounds | null {
  const coords: LngLatPair[] = [
    ...points.map((point): LngLatPair => [point.lng, point.lat]),
    ...zones.flatMap((zone) => zone.ring),
  ];
  const [first] = coords;
  if (first === undefined) return null;
  let [west, south, east, north] = [first[0], first[1], first[0], first[1]];
  for (const [lng, lat] of coords) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [west, south, east, north];
}

export function centroidOf(ring: readonly LngLatPair[]): LngLatPair | null {
  if (ring.length === 0) return null;
  const sum = ring.reduce<LngLatPair>((acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}

/** A closed GeoJSON polygon ring. */
export function zoneFeature(zone: MapZone): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring = zone.ring.map((pair): number[] => [pair[0], pair[1]]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed =
    first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1];
  return {
    type: "Feature",
    properties: { id: zone.id },
    geometry: {
      type: "Polygon",
      coordinates: [closed || first === undefined ? ring : [...ring, first]],
    },
  };
}

const PAD = 48;

/** Fit everything shown; fall back to the Merida demo view when empty. */
export function initialViewFor(
  points: readonly MapPoint[],
  zones: readonly MapZone[],
): InitialViewState {
  const bounds = boundsOf(points, zones);
  if (bounds === null) return { center: [...DEMO_CENTER], zoom: DEMO_ZOOM };
  return { bounds: [...bounds], padding: { top: PAD, right: PAD, bottom: PAD, left: PAD } };
}
