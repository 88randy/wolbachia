import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SessionGuard } from "../session/use-session-guard";
import { useSessionGuard } from "../session/use-session-guard";
import { invalidateCatalogs } from "./catalogs-query";
import { sendCatalogWrite } from "./catalog-outcome";
import type { CatalogOutcome } from "./catalog-outcome";
type Call = (guard: SessionGuard) => Promise<CatalogOutcome>;

async function runGuarded(
  call: Call,
  guard: SessionGuard,
  refresh: () => Promise<void>,
): Promise<CatalogOutcome> {
  const outcome = await call(guard);
  if (guard.isStale()) return { kind: "stale" };
  await refresh();
  return guard.isStale() ? { kind: "stale" } : outcome;
}

/** One write at a time; revision checks gate outcomes, while finally releases only the request lock. */
export function useCatalogWrite() {
  const queryClient = useQueryClient();
  const begin = useSessionGuard();
  const lock = useRef(false);
  const [isBusy, setBusy] = useState(false);
  const send = (call: Parameters<typeof sendCatalogWrite>[1], guard: SessionGuard) =>
    sendCatalogWrite(queryClient, call, guard.isStale);
  const run = async (call: Call): Promise<CatalogOutcome> => {
    if (lock.current) return { kind: "stale" };
    lock.current = true;
    setBusy(true);
    const guard = begin();
    try {
      return await runGuarded(call, guard, () => invalidateCatalogs(queryClient));
    } finally {
      lock.current = false;
      if (!guard.signal.aborted) setBusy(false);
    }
  };
  return { run, send, isBusy };
}
