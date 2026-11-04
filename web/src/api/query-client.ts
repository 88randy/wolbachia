import { ApiError } from "@wolbachia/api-client";
import { QueryClient } from "@tanstack/react-query";

/** Retries of a failed query that is worth retrying (network or 5xx). */
const MAX_RETRIES = 2;
const FIRST_CLIENT_ERROR_STATUS = 400;
const FIRST_SERVER_ERROR_STATUS = 500;

/** A 4xx answer will not change by asking again; a network failure or a 5xx might. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  const isClientError =
    error instanceof ApiError &&
    error.status >= FIRST_CLIENT_ERROR_STATUS &&
    error.status < FIRST_SERVER_ERROR_STATUS;
  return !isClientError;
}

interface AppQueryClientOptions {
  /** Tests turn retries off so a failure shows up at once. */
  retry?: boolean;
}

/** The one server-state cache of the app (ADR 0001, decision 3). */
export function createAppQueryClient(options: AppQueryClientOptions = {}): QueryClient {
  const { retry = true } = options;
  return new QueryClient({
    defaultOptions: { queries: { retry: retry ? shouldRetry : false } },
  });
}
