import type { BadgeTone } from "../ui/Badge.tsx";
import type { IconName } from "../ui/icon-paths.ts";

/** Longitude first, as in GeoJSON. */
export type LngLatPair = readonly [number, number];

/** One point on the map. `statusLabel` is already translated: status is always icon + text. */
export interface MapPoint {
  readonly id: string;
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  readonly statusLabel: string;
  readonly tone: BadgeTone;
  readonly icon: IconName;
  /** What to do here, already translated ("Colocar ovitrampa"). */
  readonly actionLabel?: string;
  /** False once the task is done: the footer then offers no "Empezar". */
  readonly isStartable?: boolean;
}

/** A quadrant polygon. `patternIndex` picks the dash pattern so color is never the only cue. */
export interface MapZone {
  readonly id: string;
  readonly label: string;
  readonly ring: readonly LngLatPair[];
  readonly tone: BadgeTone;
  readonly patternIndex: number;
}

/** Merida, Yucatan: demo region and fallback view. */
export const DEMO_CENTER: LngLatPair = [-89.6237, 20.9674];
export const DEMO_ZOOM = 13;
