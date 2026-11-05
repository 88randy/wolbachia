import { ApiError } from "@wolbachia/api-client";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { reportSessionError } from "../session/session-events";

/** Retries of a failed query that is worth retrying (network or 5xx). */
const MAX_RETRIES = 2;
const FIRST_SERVER_ERROR_STATUS = 500;

/** Only a network failure or a 5xx might change by asking again; anything else is not retried. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (error instanceof TypeError) return true; // fetch rejects with a TypeError on network failure
  return error instanceof ApiError && error.status >= FIRST_SERVER_ERROR_STATUS;
}

interface AppQueryClientOptions {
  /** Tests turn retries off so a failure shows up at once. */
  retry?: boolean;
}

/**
 * The one server-state cache of the app (ADR 0001, decision 3). Every failed query and mutation
 * is also reported to the session (an expired session, a lost membership), whichever screen
 * made the request.
 */
export function createAppQueryClient(options: AppQueryClientOptions = {}): QueryClient {
  const { retry = true } = options;
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportSessionError(error, client, query.queryKey);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        reportSessionError(error, client);
      },
    }),
    defaultOptions: {
      // "always": the browser's online flag is only a hint and the web is not offline-first.
      // With the default ("online") a request made while the flag says offline never starts, and
      // the page would wait forever instead of failing with a retry button.
      queries: { retry: retry ? shouldRetry : false, networkMode: "always" },
      mutations: { networkMode: "always" },
    },
  });
  return client;
}
