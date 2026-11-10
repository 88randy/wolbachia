import { useEffect, useRef, useState } from "react";
import type { ReceptionResult } from "./reception-command";

/** A new session revision retires its pending attempt and requires an explicit review. */
export function useReceptionCommandState(revision: number) {
  const token = useRef<symbol | null>(null);
  const previousRevision = useRef(revision);
  const [isBusy, setBusy] = useState(false);
  const [result, setResult] = useState<ReceptionResult | null>(null);
  useEffect(() => {
    if (previousRevision.current !== revision && token.current) {
      token.current = null;
      setBusy(false);
      setResult({ code: "uncertain" });
    }
    previousRevision.current = revision;
  }, [revision]);
  return { token, isBusy, setBusy, result, setResult };
}
