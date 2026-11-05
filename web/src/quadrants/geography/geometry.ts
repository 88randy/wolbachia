import type { Schemas } from "@wolbachia/api-client";
export type Polygon = Schemas["QuadrantPublicationRequest"]["geometry"];
export type ResolutionDraft = {
  point: string;
  decision: "" | Schemas["DecisionEnum"];
  evidence: string;
  location?: string;
};
const LONGITUDE_LIMIT = 180;
const LATITUDE_LIMIT = 90;
const MIN_RING_LENGTH = 4;
const MIN_VERTICES = 3;
export const EVIDENCE_MAX_LENGTH = 1000;
/** Both the map and coordinate forms serialize through this WGS84 boundary. */
export function parseLocation(text: string): number[] | null {
  const parts = text.split(",").map((part) => part.trim());
  if (parts.length !== 2 || parts.some((part) => !part)) return null;
  const coordinates = parts.map(Number);
  const [longitude = NaN, latitude = NaN] = coordinates;
  if (!coordinates.every(Number.isFinite)) return null;
  return Math.abs(longitude) <= LONGITUDE_LIMIT && Math.abs(latitude) <= LATITUDE_LIMIT
    ? coordinates
    : null;
}
function parseRing(text: string): number[][] | null {
  const vertices = text.trim().split(/\r?\n/).map(parseLocation);
  if (vertices.some((vertex) => vertex === null)) return null;
  const ring = vertices.filter((vertex): vertex is number[] => vertex !== null);
  if (ring.length < MIN_RING_LENGTH || ring[0]?.join() !== ring.at(-1)?.join()) return null;
  return new Set(ring.map((vertex) => vertex.join())).size >= MIN_VERTICES ? ring : null;
}
/** Blank lines separate rings, preserving existing holes. Backend topology validation is authoritative. */
export function parsePolygon(text: string): Polygon | null {
  const rings = text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map(parseRing);
  if (rings.some((ring) => ring === null)) return null;
  return {
    type: "Polygon",
    coordinates: rings.filter((ring): ring is number[][] => ring !== null),
  };
}
export function polygonText(polygon: Polygon | null | undefined): string {
  return (
    polygon?.coordinates
      .map((ring) => ring.map((vertex) => vertex.join(",")).join("\n"))
      .join("\n\n") ?? ""
  );
}
function isOnSegment(point: number[], start: number[], end: number[]): boolean {
  const [px, py] = point.map(Number) as [number, number];
  const [sx, sy] = start.map(Number) as [number, number];
  const [ex, ey] = end.map(Number) as [number, number];
  const cross = (px - sx) * (ey - sy) - (py - sy) * (ex - sx);
  return (
    cross === 0 &&
    px >= Math.min(sx, ex) &&
    px <= Math.max(sx, ex) &&
    py >= Math.min(sy, ey) &&
    py <= Math.max(sy, ey)
  );
}
function ringPosition(ring: number[][], point: number[]): "boundary" | "inside" | "outside" {
  const [px, py] = point.map(Number) as [number, number];
  let isInside = false;
  for (let index = 1; index < ring.length; index += 1) {
    const start = ring[index - 1] ?? [];
    const end = ring[index] ?? [];
    if (isOnSegment(point, start, end)) return "boundary";
    const [sx, sy] = start.map(Number) as [number, number];
    const [ex, ey] = end.map(Number) as [number, number];
    if (sy > py !== ey > py && px < ((ex - sx) * (py - sy)) / (ey - sy) + sx) isInside = !isInside;
  }
  return isInside ? "inside" : "outside";
}
export function containsLocation(polygon: Polygon, point: number[]): boolean {
  const positions = polygon.coordinates.map((ring) => ringPosition(ring, point));
  if (positions.includes("boundary")) return true;
  return positions[0] === "inside" && !positions.slice(1).includes("inside");
}
export function resolutionPayload(
  draft: ResolutionDraft,
  geometry: Polygon,
): Schemas["PointResolutionRequest"] | null {
  const evidence = draft.evidence.trim();
  if (!draft.decision || !evidence || evidence.length > EVIDENCE_MAX_LENGTH) return null;
  const base = { point: draft.point, decision: draft.decision, evidence };
  if (draft.decision !== "move") return base;
  const location = parseLocation(draft.location ?? "");
  return location && containsLocation(geometry, location) ? { ...base, location } : null;
}
