import type { Schemas } from "@wolbachia/api-client";
import type { Polygon } from "./geometry";
export interface MapProps {
  quadrants: readonly Schemas["Quadrant"][];
  blocks?: readonly Schemas["Block"][];
  points?: readonly Schemas["SamplingPoint"][];
  draft?: Polygon | null;
  onVertex?: (location: number[]) => void;
}
