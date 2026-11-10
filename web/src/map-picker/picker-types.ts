import type { Polygon } from "../quadrants/geography/geometry";

/** A context area drawn under the pin (block, quadrant, permit zone). */
export interface PickerArea {
  label: string;
  geometry: Polygon;
}
