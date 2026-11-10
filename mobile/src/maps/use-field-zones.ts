import { unwrap } from "@wolbachia/api-client";
import { Directory, File, Paths } from "expo-file-system";
import { useEffect, useState } from "react";
import { useServices } from "../app/services-context.ts";
import { createMobileApiClient } from "../api/create-api-client.ts";
import type { LngLatPair, MapZone } from "./map-types.ts";

interface Zone {
  readonly id: string;
  readonly code: string;
  readonly ring: readonly (readonly number[])[];
}

function cacheFile(): File {
  return new File(new Directory(Paths.document, "maps"), "zones.json");
}

function readCache(): readonly Zone[] {
  try {
    const file = cacheFile();
    return file.exists ? (JSON.parse(file.textSync()) as readonly Zone[]) : [];
  } catch {
    return [];
  }
}

function toZones(zones: readonly Zone[]): readonly MapZone[] {
  return zones.flatMap((zone, index) => {
    const ring = zone.ring.flatMap((pair) =>
      pair.length >= 2 ? [[pair[0], pair[1]] as unknown as LngLatPair] : [],
    );
    return ring.length < 4
      ? []
      : [{ id: zone.id, label: zone.code, ring, tone: "info" as const, patternIndex: index }];
  });
}

/**
 * Quadrant polygons of the courier, for the day map. The last answer is kept on the phone, so the
 * zones still show offline; a failed download keeps what was there.
 */
export function useFieldZones(): readonly MapZone[] {
  const { tokens, server } = useServices();
  const [zones, setZones] = useState<readonly Zone[]>(readCache);
  useEffect(() => {
    const baseUrl = server.baseUrl();
    if (baseUrl === null || tokens.getAccessToken() === undefined) return undefined;
    let isActive = true;
    const client = createMobileApiClient({ baseUrl, tokens });
    void client
      .GET("/api/v1/field/zones/")
      .then((response) => {
        const fresh = unwrap(response) as readonly Zone[];
        const file = cacheFile();
        new Directory(Paths.document, "maps").create({ idempotent: true, intermediates: true });
        file.write(JSON.stringify(fresh));
        if (isActive) setZones(fresh);
      })
      .catch(() => undefined);
    return () => {
      isActive = false;
    };
  }, [server, tokens]);
  return toZones(zones);
}
