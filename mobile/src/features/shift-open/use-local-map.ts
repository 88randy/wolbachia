import { useState } from "react";
import { cachedTilesUri } from "../../maps/map-tiles-cache.ts";

/** True when the map extract is really on the phone (the Mapa tab then works without internet). */
export function useLocalMap(): boolean {
  const [isOnDevice] = useState(() => cachedTilesUri() !== null);
  return isOnDevice;
}
