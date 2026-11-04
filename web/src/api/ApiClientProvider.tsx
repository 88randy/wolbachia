import type { ApiClient } from "@wolbachia/api-client";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";

const ApiClientContext = createContext<ApiClient | null>(null);

/** Gives the screens the one API client built from the validated configuration. */
export function ApiClientProvider({
  client,
  children,
}: {
  client: ApiClient;
  children: ReactNode;
}) {
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (client === null) throw new Error("useApiClient must be used inside <ApiClientProvider>");
  return client;
}
