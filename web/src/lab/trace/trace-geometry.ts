const EARTH_RADIUS_M = 6_371_008.8;
const STEPS = 48;
const FULL_TURN = 2 * Math.PI;

/** A closed ring of `STEPS` vertices around `[lng, lat]` at `radiusM` meters (GPS accuracy circle). */
export function circleRing(lng: number, lat: number, radiusM: number): number[][] {
  const latRad = (lat * Math.PI) / 180;
  const ring = Array.from({ length: STEPS }, (_, step) => {
    const angle = (step / STEPS) * FULL_TURN;
    const dLat = (radiusM / EARTH_RADIUS_M) * Math.cos(angle);
    const dLng = (radiusM / (EARTH_RADIUS_M * Math.cos(latRad))) * Math.sin(angle);
    return [lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI] as number[];
  });
  return [...ring, ring[0] ?? [lng, lat]];
}

/** `[[west, south], [east, north]]` of every given position, or null when there are none. */
export function boundsOf(
  positions: readonly (readonly number[])[],
): [[number, number], [number, number]] | null {
  if (positions.length === 0) return null;
  const lngs = positions.map((position) => position[0] ?? 0);
  const lats = positions.map((position) => position[1] ?? 0);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
