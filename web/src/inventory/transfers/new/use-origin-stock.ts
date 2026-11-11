import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { inventoryScopedOptions } from "../../inventory-read-context";
import { useInventoryContext } from "../../use-inventory-context";
import type { StockChoice } from "./transfer-draft";

const PAGE_SIZE = 100;

/** What the chosen origin holds now, by lot: the only things that can be sent from it. */
export function useOriginStock(originId: string) {
  const scope = useInventoryContext();
  const stockOptions = inventoryScopedOptions(scope, {
    key: ["inventory", "origin-stock", originId],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/locations/{id}/stock/", {
          params: { path: { id: originId }, query: { page_size: PAGE_SIZE } },
          signal,
        }),
      ).results,
  });
  const lotOptions = inventoryScopedOptions(scope, {
    key: ["inventory", "origin-stock-lots", originId],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/lots/", {
          params: { query: { page_size: PAGE_SIZE } },
          signal,
        }),
      ).results,
  });
  const stock = useQuery({ ...stockOptions, enabled: stockOptions.enabled && originId !== "" });
  const lots = useQuery({ ...lotOptions, enabled: lotOptions.enabled && originId !== "" });
  const choices = useMemo(() => {
    const byLot = new Map((lots.data ?? []).map((lot) => [lot.id, lot]));
    const found = new Map<string, StockChoice>();
    for (const row of stock.data ?? []) {
      const lot = byLot.get(row.lot);
      if (row.piece_id !== null || !lot) continue;
      found.set(row.lot, {
        lotId: row.lot,
        lotCode: row.lot_code,
        supplyLabel: lot.supply_version.label,
        unit: row.unit,
        available: row.quantity,
        unitVersionId: lot.supply_version_id,
      });
    }
    return found;
  }, [stock.data, lots.data]);
  return {
    choices,
    isLoading: originId !== "" && (stock.isPending || lots.isPending),
    isError: stock.isError || lots.isError,
    refetch: () => {
      void stock.refetch();
      void lots.refetch();
    },
  };
}
