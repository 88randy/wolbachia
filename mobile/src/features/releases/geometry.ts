import { isCoordinates, isRecord } from "../day/assignment-parser.ts";

type Position = readonly [number, number];
type Ring = readonly Position[];
type RingPosition = "inside" | "outside" | "boundary";

function position(value: unknown): value is Position {
  return Array.isArray(value) && value.length === 2 && isCoordinates(value[1], value[0]);
}
function ring(value: unknown): value is Ring {
  if (!Array.isArray(value) || value.length < 4 || !value.every(position)) return false;
  const first = value[0],
    last = value.at(-1);
  return first?.[0] === last?.[0] && first?.[1] === last?.[1];
}
function onSegment(point: Position, start: Position, end: Position): boolean {
  return (
    (point[0] - start[0]) * (end[1] - start[1]) === (point[1] - start[1]) * (end[0] - start[0]) &&
    point[0] >= Math.min(start[0], end[0]) &&
    point[0] <= Math.max(start[0], end[0]) &&
    point[1] >= Math.min(start[1], end[1]) &&
    point[1] <= Math.max(start[1], end[1])
  );
}
function locate(point: Position, vertices: Ring): RingPosition {
  let inside = false;
  for (let index = 1; index < vertices.length; index += 1) {
    const start = vertices[index - 1],
      end = vertices[index];
    if (!start || !end) return "outside";
    if (onSegment(point, start, end)) return "boundary";
    if (
      start[1] > point[1] !== end[1] > point[1] &&
      point[0] < ((end[0] - start[0]) * (point[1] - start[1])) / (end[1] - start[1]) + start[0]
    )
      inside = !inside;
  }
  return inside ? "inside" : "outside";
}
/** Matches B20's Polygon covers semantics, including exterior and hole boundaries. */
export function permitCovers(geometry: unknown, point: Position): boolean | null {
  if (!isRecord(geometry) || geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates))
    return null;
  const rings: unknown[] = geometry.coordinates;
  if (!rings.length || !rings.every(ring)) return null;
  const longitudes = rings.flatMap((vertices) => vertices.map(([longitude]) => longitude));
  if (Math.max(...longitudes) - Math.min(...longitudes) > 180) return null;
  const [exterior, ...holes] = rings;
  if (!exterior || locate(point, exterior) === "outside") return false;
  return !holes.some((hole) => locate(point, hole) === "inside");
}
