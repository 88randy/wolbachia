import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { useCan } from "../../session/use-can";
import { inventoryScopedOptions } from "../inventory-read-context";
import { useInventoryContext } from "../use-inventory-context";

export type Scope = ReturnType<typeof useInventoryContext>;

type TotalTarget = { key: string; enabled: boolean };
type TotalRead = (client: Scope["client"]) => Promise<{ count: number }>;

/** Query options of a one-row read; usable with `useQueries` for a list of totals. */
export function totalOptions(scope: Scope, target: TotalTarget, read: TotalRead) {
  const options = inventoryScopedOptions(scope, {
    key: ["inventory", "hub", target.key],
    queryFn: () => read(scope.client),
  });
  return { ...options, enabled: options.enabled && target.enabled };
}

/** One-row read: only the total is used, so the hub never downloads records. */
export function useTotal(scope: Scope, target: TotalTarget, read: TotalRead) {
  return useQuery(totalOptions(scope, target, read)).data?.count;
}

/** The live numbers on the hub cards. */
export function useInventoryHub() {
  const scope = useInventoryContext();
  const can = useCan();
  const transfers = (state: "prepared" | "dispatched") => (client: Scope["client"]) =>
    client.GET("/api/v1/transfers/", { params: { query: { page_size: 1, state } } }).then(unwrap);
  return {
    locations: useTotal(scope, { key: "locations", enabled: can("location.read") }, (client) =>
      client.GET("/api/v1/locations/", { params: { query: { page_size: 1 } } }).then(unwrap),
    ),
    supplies: useTotal(scope, { key: "supplies", enabled: can("supply_type.read") }, (client) =>
      client
        .GET("/api/v1/supply-types/", { params: { query: { page_size: 1, is_active: "true" } } })
        .then(unwrap),
    ),
    lots: useTotal(scope, { key: "lots", enabled: can("lot.read") }, (client) =>
      client.GET("/api/v1/lots/", { params: { query: { page_size: 1 } } }).then(unwrap),
    ),
    inTransit: useTotal(
      scope,
      { key: "in-transit", enabled: can("transfer.read") },
      transfers("dispatched"),
    ),
    prepared: useTotal(
      scope,
      { key: "prepared", enabled: can("transfer.read") },
      transfers("prepared"),
    ),
    openDiscrepancies: useTotal(
      scope,
      { key: "discrepancies", enabled: can("discrepancy.read") },
      (client) =>
        client
          .GET("/api/v1/discrepancies/", { params: { query: { page_size: 1, status: "open" } } })
          .then(unwrap),
    ),
  };
}
export type InventoryHubFacts = ReturnType<typeof useInventoryHub>;
