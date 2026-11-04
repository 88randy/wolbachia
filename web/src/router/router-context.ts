import type { QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@wolbachia/api-client";

/** What every route can reach: the one API client and the server-state cache. */
export interface RouterContext {
  client: ApiClient;
  queryClient: QueryClient;
}
