import type { Schemas } from "@wolbachia/api-client";

export type Location = Schemas["Location"];

/** Pins closer than this many screen pixels share one clustered pin. */
export const CLUSTER_RADIUS_PX = 36;
/** Zoom used when every location sits on one point (no extent to fit). */
export const SINGLE_POINT_ZOOM = 15;
/** Fit never zooms closer than this, so a tight group still shows some surroundings. */
export const FIT_MAX_ZOOM = 17;

const TILE_SIZE = 256;
const MAX_LATITUDE = 85.0511;

export interface LocationCluster {
  /** Stable while the member set is the same: the sorted member ids. */
  key: string;
  longitude: number;
  latitude: number;
  locations: readonly Location[];
}

export function pointOf(location: Location): { lng: number; lat: number } {
  return {
    lng: Number(location.geometry.coordinates[0]),
    lat: Number(location.geometry.coordinates[1]),
  };
}

/** Web-Mercator world pixels at `zoom` (the projection the base map uses). */
function toWorldPixels(lng: number, lat: number, zoom: number): [number, number] {
  const scale = TILE_SIZE * 2 ** zoom;
  const clamped = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return [
    ((lng + 180) / 360) * scale,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  ];
}

interface Group {
  anchor: [number, number];
  members: Location[];
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Greedy, order-stable clustering by screen distance. Identical coordinates always share a
 * cluster, at any zoom; near ones split apart as the map zooms in.
 */
export function clusterLocations(
  locations: readonly Location[],
  zoom: number,
  radiusPx: number = CLUSTER_RADIUS_PX,
): LocationCluster[] {
  const groups: Group[] = [];
  for (const location of locations) {
    const { lng, lat } = pointOf(location);
    const pixel = toWorldPixels(lng, lat, zoom);
    const group = groups.find(
      (candidate) =>
        Math.hypot(candidate.anchor[0] - pixel[0], candidate.anchor[1] - pixel[1]) <= radiusPx,
    );
    if (group) group.members.push(location);
    else groups.push({ anchor: pixel, members: [location] });
  }
  return groups.map(({ members }) => {
    const points = members.map(pointOf);
    return {
      key: members
        .map((member) => member.id)
        .sort()
        .join("|"),
      longitude: mean(points.map((p) => p.lng)),
      latitude: mean(points.map((p) => p.lat)),
      locations: members,
    };
  });
}

export type InitialView =
  | { bounds: [[number, number], [number, number]]; maxZoom: number }
  | { longitude: number; latitude: number; zoom: number };

/** Fit to the pins; a zero-extent set (all on one point) is centered at a fixed zoom instead. */
export function initialView(locations: readonly Location[]): InitialView {
  const points = locations.map(pointOf);
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  const [west, east] = [Math.min(...lngs), Math.max(...lngs)];
  const [south, north] = [Math.min(...lats), Math.max(...lats)];
  if (west === east && south === north) {
    return { longitude: west, latitude: south, zoom: SINGLE_POINT_ZOOM };
  }
  return {
    bounds: [
      [west, south],
      [east, north],
    ],
    maxZoom: FIT_MAX_ZOOM,
  };
}

export type PinShape = "circle" | "square" | "diamond";

/** Shape plus icon (not color alone) tell the location types apart. */
export const PIN_SHAPE: Record<Location["kind"], PinShape> = {
  center: "circle",
  warehouse: "square",
  biofactory: "diamond",
};
