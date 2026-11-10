import type { PolygonBody } from "./permit-geometry";

type Point = readonly [number, number];

function cross(o: Point, a: Point, b: Point): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Convex hull (monotone chain) of the points, counter-clockwise, without the closing repeat. */
function hull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const build = (list: readonly Point[]) => {
    const chain: Point[] = [];
    for (const point of list) {
      while (chain.length >= 2) {
        const last = chain[chain.length - 1];
        const before = chain[chain.length - 2];
        if (last === undefined || before === undefined || cross(before, last, point) > 0) break;
        chain.pop();
      }
      chain.push(point);
    }
    chain.pop();
    return chain;
  };
  return [...build(sorted), ...build([...sorted].reverse())];
}

/**
 * The zone of the chosen quadrants: one quadrant gives its own outline; several give the smallest
 * convex outline around all of them (a permit zone is one polygon).
 */
export function zoneFromQuadrants(
  outlines: readonly (readonly (readonly number[])[])[],
): PolygonBody | null {
  const points = outlines.flatMap((ring) =>
    ring.slice(0, -1).map(([lng = 0, lat = 0]) => [lng, lat] as const),
  );
  if (outlines.length === 1) {
    const only = outlines[0];
    return only === undefined ? null : { type: "Polygon", coordinates: [only.map((p) => [...p])] };
  }
  const outline = hull(points);
  const first = outline[0];
  if (outline.length < 3 || first === undefined) return null;
  return {
    type: "Polygon",
    coordinates: [[...outline, first].map(([lng, lat]) => [lng, lat])],
  };
}
