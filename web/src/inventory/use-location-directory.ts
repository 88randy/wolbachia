import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { useCan } from "../session/use-can";
import { inventoryScopedOptions } from "./inventory-read-context";
import { useInventoryContext } from "./use-inventory-context";

const PAGE_SIZE = 100;
export type DirectoryLocation = Schemas["Location"];

/** Every readable warehouse and storage point, for pickers that must show names. */
export function useLocationDirectory() {
  const scope = useInventoryContext();
  const can = useCan();
  const options = inventoryScopedOptions(scope, {
    key: ["inventory", "location-directory"],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/locations/", {
          params: { query: { page_size: PAGE_SIZE } },
          signal,
        }),
      ).results,
  });
  return useQuery({ ...options, enabled: options.enabled && can("location.read") });
}
