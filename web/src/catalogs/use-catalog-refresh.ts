import { useQueryClient } from "@tanstack/react-query";
import { invalidateCatalogs } from "./catalogs-query";
/** One retry refreshes both the picker and its canonical catalog metadata. */
export function useCatalogRefresh() {
  const queryClient = useQueryClient();
  return () => invalidateCatalogs(queryClient);
}
