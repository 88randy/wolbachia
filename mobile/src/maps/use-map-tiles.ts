import { useCallback, useEffect, useState } from "react";
import { useServices } from "../app/services-context.ts";
import { cachedTilesUri, downloadTiles } from "./map-tiles-cache.ts";

export type MapTilesState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly uri: string }
  | { readonly kind: "unavailable" };

interface Request {
  readonly origin: string | null;
  readonly attempt: number;
}

function useDownloadWhenMissing(
  { origin, attempt }: Request,
  isReady: boolean,
  setState: (state: MapTilesState) => void,
): void {
  useEffect(() => {
    if (isReady) return undefined;
    if (origin === null) {
      setState({ kind: "unavailable" });
      return undefined;
    }
    let active = true;
    downloadTiles(origin)
      .then((uri) => {
        if (active) setState({ kind: "ready", uri });
      })
      .catch(() => {
        if (active) setState({ kind: "unavailable" });
      });
    return () => {
      active = false;
    };
    // Runs per attempt or origin change only; `isReady` is a guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, origin]);
}

/** Cached extract first (offline); downloads once when missing. Never blocks other UI. */
export function useMapTiles(): { readonly state: MapTilesState; readonly retry: () => void } {
  const { server } = useServices();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<MapTilesState>(() => {
    const uri = cachedTilesUri();
    return uri === null ? { kind: "loading" } : { kind: "ready", uri };
  });
  useDownloadWhenMissing({ origin: server.baseUrl(), attempt }, state.kind === "ready", setState);
  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((value) => value + 1);
  }, []);
  return { state, retry };
}
