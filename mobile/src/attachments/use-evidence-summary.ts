import { useEffect, useState } from "react";
import { useServices } from "../app/services-context.ts";
import { useSyncSnapshot } from "../sync/use-sync.ts";

/** File errors remain distinct from immutable per-event delivery/review receipts. */
export function useEvidenceSummary() {
  const { attachments } = useServices();
  const snapshot = useSyncSnapshot();
  const [summary, setSummary] = useState({ pending: 0, hasError: false });
  useEffect(() => {
    let isCurrent = true;
    void attachments.store
      .pendingSummary()
      .then((next) => {
        if (isCurrent) setSummary(next);
      })
      .catch(() => {
        if (isCurrent) setSummary({ pending: 0, hasError: true });
      });
    return () => {
      isCurrent = false;
    };
  }, [attachments, snapshot]);
  return summary;
}
