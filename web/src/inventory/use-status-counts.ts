import { useQueries } from "@tanstack/react-query";
import { useCan } from "../session/use-can";
import { totalOptions } from "./hub/use-inventory-hub";
import { useInventoryContext } from "./use-inventory-context";

const TRANSFER_STATES = [
  "",
  "prepared",
  "dispatched",
  "discrepancy",
  "received",
  "resolved",
] as const;
const DISCREPANCY_STATUSES = ["", "open", "closed"] as const;

/** Totals per status tab of the transfer list ("" is all). One-row reads. */
export function useTransferCounts() {
  const scope = useInventoryContext();
  const enabled = useCan()("transfer.read");
  const results = useQueries({
    queries: TRANSFER_STATES.map((state) =>
      totalOptions(scope, { key: `tab-transfer-${state}`, enabled }, (client) =>
        client
          .GET("/api/v1/transfers/", {
            params: { query: { page_size: 1, ...(state ? { state } : {}) } },
          })
          .then((response) => response.data as { count: number }),
      ),
    ),
  });
  return defined(TRANSFER_STATES, results);
}

/** Totals per status tab of the discrepancy list. */
export function useDiscrepancyCounts() {
  const scope = useInventoryContext();
  const enabled = useCan()("discrepancy.read");
  const results = useQueries({
    queries: DISCREPANCY_STATUSES.map((status) =>
      totalOptions(scope, { key: `tab-discrepancy-${status}`, enabled }, (client) =>
        client
          .GET("/api/v1/discrepancies/", {
            params: { query: { page_size: 1, ...(status ? { status } : {}) } },
          })
          .then((response) => response.data as { count: number }),
      ),
    ),
  });
  return defined(DISCREPANCY_STATUSES, results);
}

function defined(
  keys: readonly string[],
  results: readonly { data?: { count: number } }[],
): Record<string, number> | undefined {
  const counts = results.map((result) => result.data?.count);
  if (counts.some((value) => value === undefined)) return undefined;
  return Object.fromEntries(keys.map((key, index) => [key, counts[index] ?? 0]));
}
