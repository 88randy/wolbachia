import { ApiError } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import type { QueryClient } from "@tanstack/react-query";
import { tableErrorKey } from "../data-table/table-error";
import { reportSessionError } from "../session/session-events";
import type { SessionGuard } from "../session/use-session-guard";
import type { MotorcycleValues } from "./motorcycle-schema";
export type CreateOutcome =
  { kind: "saved" | "stale" | "duplicate" } | { kind: "failed"; key: MessageKey };
interface Options {
  client: ApiClient;
  queryClient: QueryClient;
  guard: SessionGuard;
  values: MotorcycleValues;
}
/** One guarded create; a duplicate is attached to the immutable human-code field. */
export async function createMotorcycle({
  client,
  queryClient,
  guard,
  values,
}: Options): Promise<CreateOutcome> {
  try {
    const result = await client.POST("/api/v1/motorcycles/", {
      body: values,
      signal: guard.signal,
    });
    if (guard.isStale()) return { kind: "stale" };
    if (result.response.ok) return { kind: "saved" };
    const error = new ApiError(result.response.status, result.error);
    reportSessionError(error, queryClient);
    if (result.error?.fields?.["code"]?.some((issue) => issue.code === "duplicate_code"))
      return { kind: "duplicate" };
    return { kind: "failed", key: tableErrorKey(error) };
  } catch (caught) {
    if (guard.isStale()) return { kind: "stale" };
    console.error("The motorcycle create request failed", caught);
    return { kind: "failed", key: tableErrorKey(caught) };
  }
}
