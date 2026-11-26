import { useCallback, useEffect, useRef, useState } from "react";
import type { M04Model } from "./use-m-04.ts";

/**
 * Downloads the safety list and the fleet by itself when the opening starts. Nothing here is a
 * step for the courier: offline, the copy already on the phone is used.
 */
export function useCatalogDownload(model: M04Model) {
  const [isLoading, setLoading] = useState(false);
  const latest = useRef(model);
  latest.current = model;
  const download = useCallback(() => {
    setLoading(true);
    const { service, refresh } = latest.current;
    void service
      .refreshCatalog()
      .catch(() => undefined)
      .then(() => refresh().catch(() => undefined))
      .finally(() => {
        setLoading(false);
      });
  }, []);
  useEffect(download, [download]);
  return { isLoading, retry: download };
}
