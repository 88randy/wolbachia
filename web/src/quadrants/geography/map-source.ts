export const DEFAULT_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";
export const MAX_MAP_ZOOM = 19;
export interface MapSource {
  url: string;
  attribution: string;
  isRaster: boolean;
}
export interface TileEnvironment {
  VITE_MAP_TILES_URL?: unknown;
  VITE_MAP_ATTRIBUTION?: unknown;
}
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "https://same-origin.invalid");
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      !url.startsWith("//") &&
      !url.includes("\\")
    );
  } catch {
    return false;
  }
}
/** Public build configuration; malformed source/attribution falls back to the coordinate workflow. */
export function readMapSource(environment: TileEnvironment): MapSource | null {
  const value = environment.VITE_MAP_TILES_URL;
  const url = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_TILES;
  const isRaster = ["{x}", "{y}", "{z}"].every((part) => url.includes(part));
  if (!isSafeUrl(url) || (url.includes("{") && !isRaster)) return null;
  const attribution =
    typeof environment.VITE_MAP_ATTRIBUTION === "string"
      ? environment.VITE_MAP_ATTRIBUTION.trim()
      : "";
  if (url !== DEFAULT_TILES && !attribution) return null;
  return { url, isRaster, attribution };
}
