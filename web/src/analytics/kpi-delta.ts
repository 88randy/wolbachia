export type DeltaDirection = "up" | "down" | "unchanged";
/** Direction is carried by a sign, an icon and speech, never only by color. */
export function deltaDirection(delta: number): DeltaDirection {
  if (delta > 0) return "up";
  return delta < 0 ? "down" : "unchanged";
}
