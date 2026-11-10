export type Vertex = readonly [number, number];

export interface PolygonBody {
  type: "Polygon";
  coordinates: number[][][];
}

function isPair(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((part) => typeof part === "number" && Number.isFinite(part))
  );
}

function isPolygon(value: unknown): value is PolygonBody {
  if (typeof value !== "object" || value === null) return false;
  const { type, coordinates } = value as { type?: unknown; coordinates?: unknown };
  return (
    type === "Polygon" &&
    Array.isArray(coordinates) &&
    coordinates.length > 0 &&
    coordinates.every((ring) => Array.isArray(ring) && ring.length >= 4 && ring.every(isPair))
  );
}

/** Shape check of pasted GeoJSON; the backend still validates the real geometry. */
export function parsePolygon(text: string): PolygonBody | null {
  try {
    const value: unknown = JSON.parse(text);
    return isPolygon(value) ? value : null;
  } catch {
    return null;
  }
}

/** Vertices of the outer ring without the closing repeat: the table alternative of a map. */
export function outerVertices(geometry: unknown): readonly Vertex[] {
  if (!isPolygon(geometry)) return [];
  const ring = geometry.coordinates[0] ?? [];
  return ring.slice(0, -1).map(([lng = 0, lat = 0]) => [lng, lat] as const);
}
