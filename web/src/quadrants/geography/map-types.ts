import type { Schemas } from "@wolbachia/api-client";
import type { Polygon } from "./geometry";
/** A courier's last position: `label` already carries the age when `isStale`. */
export interface MapCourier {
  id: string;
  label: string;
  at: [number, number];
  isStale: boolean;
}
export interface MapProps {
  quadrants: readonly Schemas["Quadrant"][];
  blocks?: readonly Schemas["Block"][];
  points?: readonly Schemas["SamplingPoint"][];
  draft?: Polygon | null;
  onVertex?: (location: number[]) => void;
  couriers?: readonly MapCourier[];
  /** One `[lng, lat]` line per track segment. */
  track?: readonly [number, number][][];
}
