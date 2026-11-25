/** One kept fix of the courier track: device time (ms since epoch), WGS84 degrees, accuracy in metres. */
export interface TrackFix {
  readonly at: number;
  readonly lat: number;
  readonly lng: number;
  readonly accuracyM: number;
}

const EARTH_RADIUS_M = 6_371_000;
const RADIANS = Math.PI / 180;

/** Local flat projection in metres around `origin`; exact enough for a few kilometres of street. */
function project(point: TrackFix, origin: TrackFix): readonly [number, number] {
  const x = (point.lng - origin.lng) * RADIANS * Math.cos(origin.lat * RADIANS) * EARTH_RADIUS_M;
  const y = (point.lat - origin.lat) * RADIANS * EARTH_RADIUS_M;
  return [x, y];
}

export function metersBetween(a: TrackFix, b: TrackFix): number {
  const [x, y] = project(b, a);
  return Math.hypot(x, y);
}

function distanceToSegment(point: TrackFix, start: TrackFix, end: TrackFix): number {
  const [px, py] = project(point, start);
  const [ex, ey] = project(end, start);
  const length = ex * ex + ey * ey;
  if (length === 0) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * ex + py * ey) / length));
  return Math.hypot(px - t * ex, py - t * ey);
}

/** Index of the point between `first` and `last` farthest beyond `toleranceM` from their chord, or -1. */
function farthestBeyond(
  points: readonly TrackFix[],
  range: readonly [number, number],
  toleranceM: number,
): number {
  const [first, last] = range;
  const start = points[first];
  const end = points[last];
  let farthest = -1;
  let farthestM = toleranceM;
  for (let index = first + 1; index < last && start && end; index++) {
    const point = points[index];
    const distance = point === undefined ? 0 : distanceToSegment(point, start, end);
    if (distance > farthestM) [farthest, farthestM] = [index, distance];
  }
  return farthest;
}

/**
 * Douglas-Peucker: drops points closer than `toleranceM` to the line through their neighbours.
 * First and last always stay, and so does a point that follows a time gap of at least `pinGapMs`
 * (a stillness heartbeat), so stops keep their time. Iterative: no recursion depth on long days.
 */
export function simplifyTrack(
  points: readonly TrackFix[],
  toleranceM: number,
  pinGapMs = Infinity,
): readonly TrackFix[] {
  if (points.length <= 2) return points;
  const keep = points.map(
    (point, index) =>
      index === 0 ||
      index === points.length - 1 ||
      point.at - (points[index - 1]?.at ?? point.at) >= pinGapMs,
  );
  const pinned = keep.flatMap((isKept, index) => (isKept ? [index] : []));
  const stack: [number, number][] = pinned.slice(1).map((end, index) => [pinned[index] ?? 0, end]);
  for (let range = stack.pop(); range !== undefined; range = stack.pop()) {
    const farthest = farthestBeyond(points, range, toleranceM);
    if (farthest === -1) continue;
    keep[farthest] = true;
    stack.push([range[0], farthest], [farthest, range[1]]);
  }
  return points.filter((_, index) => keep[index]);
}
