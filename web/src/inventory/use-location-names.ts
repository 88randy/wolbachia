import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { inventoryScopedOptions } from "./inventory-read-context";
import type { InventoryScope } from "./inventory-query";
import { useInventoryContext } from "./use-inventory-context";

const LOCATION_PAGE_SIZE = 100;

function locationNameOptions(scope: InventoryScope) {
  return inventoryScopedOptions(scope, {
    key: ["inventory", "location-names"],
    queryFn: async ({ signal }) => {
      const query = { page: 1, page_size: LOCATION_PAGE_SIZE };
      const page = unwrap(
        await scope.client.GET("/api/v1/locations/", { params: { query }, signal }),
      );
      return new Map(page.results.map((row) => [row.id, row.name]));
    },
  });
}

/** Readable names of locations by id, so screens never show a raw identifier. */
export function useLocationNames(): (id: string) => string | undefined {
  const scope = useInventoryContext();
  const query = useQuery(locationNameOptions(scope));
  return (id) => query.data?.get(id);
}
