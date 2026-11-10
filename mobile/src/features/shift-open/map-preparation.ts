import { File } from "expo-file-system";
import { cachedTilesUri, downloadTiles } from "../../maps/map-tiles-cache.ts";
import type { MapPreparation, MapPreparationSource } from "./domain.ts";
import { UNAVAILABLE_MAP } from "./domain.ts";

const ASSET_ID = "merida.pmtiles";
const AREA = "merida";
const LICENSE = "ODbL, OpenStreetMap contributors";

function readyMap(uri: string): MapPreparation {
  return {
    status: "ready",
    version: "merida",
    requiredCoverage: [AREA],
    coverage: [AREA],
    assets: [{ id: ASSET_ID, license: LICENSE }],
    verifiedAssets: [{ id: ASSET_ID, fileRef: uri, size: new File(uri).size }],
    progress: 100,
    error: null,
  };
}

/**
 * Prepares the offline city map for the shift gate: uses the extract already on the phone, or
 * downloads it once from our own server. The courier never sees this as a step of their own.
 */
export function createMapPreparation(getOrigin: () => string | null): MapPreparationSource {
  return {
    async prepare(publish, previous) {
      const cached = cachedTilesUri();
      if (cached !== null) return readyMap(cached);
      const origin = getOrigin();
      const base = previous ?? UNAVAILABLE_MAP;
      if (origin === null) return { ...base, status: "failed", error: "no_server" };
      await publish({ ...base, status: "preparing", progress: 10, error: null });
      return readyMap(await downloadTiles(origin));
    },
  };
}
