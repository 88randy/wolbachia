import { useEffect, useState } from "react";
import { useServices } from "../../app/services-context.ts";
import type { ScannerResult } from "./domain.ts";

/** Re-read current local authority on every sync/session change; never retain hidden detail. */
export function useSupplyDetail(lotId: string) {
  const { scanner, engine, auth, tokens } = useServices();
  const [result, setResult] = useState<ScannerResult | null>(null);
  useEffect(() => {
    let revision = 0;
    const refresh = () => {
      const request = ++revision;
      setResult(null);
      void scanner
        .resolve({ value: `wbf:1:lot:${lotId}`, isManual: false })
        .then((next) => {
          if (request === revision) setResult(next);
        })
        .catch(() => {
          if (request === revision) setResult({ error: "storage" });
        });
    };
    const remove = [engine.subscribe(refresh), auth.subscribe(refresh), tokens.subscribe(refresh)];
    refresh();
    return () => {
      revision++;
      for (const unsubscribe of remove) unsubscribe();
    };
  }, [lotId, scanner, engine, auth, tokens]);
  return result;
}
