import { useCan } from "../session/use-can";
import { useTotal } from "./hub/use-inventory-hub";
import { useInventoryContext } from "./use-inventory-context";

/** Totals per status tab of the transfer list ("" is all). One-row reads. */
export function useTransferCounts() {
  const scope = useInventoryContext();
  const enabled = useCan()("transfer.read");
  const count = (state: "prepared" | "dispatched" | "discrepancy" | "received" | "resolved" | "") =>
    useTotal(scope, { key: `tab-transfer-${state}`, enabled }, (client) =>
      client
        .GET("/api/v1/transfers/", {
          params: { query: { page_size: 1, ...(state ? { state } : {}) } },
        })
        .then((response) => response.data as { count: number }),
    );
  const counts = {
    "": count(""),
    prepared: count("prepared"),
    dispatched: count("dispatched"),
    discrepancy: count("discrepancy"),
    received: count("received"),
    resolved: count("resolved"),
  };
  return defined(counts);
}

/** Totals per status tab of the discrepancy list. */
export function useDiscrepancyCounts() {
  const scope = useInventoryContext();
  const enabled = useCan()("discrepancy.read");
  const count = (status: "open" | "closed" | "") =>
    useTotal(scope, { key: `tab-discrepancy-${status}`, enabled }, (client) =>
      client
        .GET("/api/v1/discrepancies/", {
          params: { query: { page_size: 1, ...(status ? { status } : {}) } },
        })
        .then((response) => response.data as { count: number }),
    );
  return defined({ "": count(""), open: count("open"), closed: count("closed") });
}

function defined(counts: Record<string, number | undefined>): Record<string, number> | undefined {
  const entries = Object.entries(counts);
  if (entries.some(([, value]) => value === undefined)) return undefined;
  return Object.fromEntries(entries) as Record<string, number>;
}
