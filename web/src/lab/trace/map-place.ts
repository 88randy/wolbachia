import type { BagTrace } from "./trace-query";

/** What the origin map draws: one sampling point, optionally the GPS reading, and the outlines around it. */
export interface MapPlace {
  pointCode: string;
  /** `[longitude, latitude]`. */
  point: readonly number[];
  capture: { lat: number; lng: number; accuracy_m: number | null } | null;
  /** GeoJSON polygon of the block, or null when it is not known. */
  block: unknown;
  /** GeoJSON polygon of the quadrant, or null when it is not known. */
  quadrant: unknown;
  /** Keep the point in the middle of the map instead of fitting every position. */
  isCentered?: boolean;
}

/** The place of a bag origin: the point, the courier's GPS reading and both outlines. */
export function tracePlace(trace: BagTrace): MapPlace {
  const { location, reading } = trace;
  return {
    pointCode: location.point.code,
    point: location.point.location,
    capture: reading.capture,
    block: location.block.geometry,
    quadrant: location.quadrant.geometry,
  };
}
