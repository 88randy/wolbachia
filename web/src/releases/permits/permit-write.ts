import { ApiError } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import type { QueryClient } from "@tanstack/react-query";
import { tableErrorKey } from "../../data-table/table-error";
import { reportSessionError } from "../../session/session-events";
import type { SessionGuard } from "../../session/use-session-guard";

export type WriteOutcome =
  | { kind: "saved" | "stale" | "duplicate" }
  | { kind: "conflict"; reason: string }
  | { kind: "failed"; key: MessageKey };

interface Answer {
  response: Response;
  error?: unknown;
}

const CONFLICT = 409;
const DUPLICATES = new Set(["permit_code_conflict", "permit_type_code_conflict"]);

/** First `blocked_by` reason of a 409 (`release_state_conflict`), if the body carries one. */
export function conflictReason(error: unknown): string {
  const list = (error as { blocked_by?: { reason?: unknown }[] } | undefined)?.blocked_by;
  const reason = list?.[0]?.reason;
  return typeof reason === "string" ? reason : "";
}

interface Options {
  queryClient: QueryClient;
  guard: SessionGuard;
  send: () => Promise<Answer>;
}

/** One explicit attempt: nothing here retries or replays a write after a failure. */
export async function runPermitWrite({ queryClient, guard, send }: Options): Promise<WriteOutcome> {
  try {
    const answer = await send();
    if (guard.isStale()) return { kind: "stale" };
    if (answer.response.ok) return { kind: "saved" };
    const failure = new ApiError(
      answer.response.status,
      answer.error as ConstructorParameters<typeof ApiError>[1],
    );
    reportSessionError(failure, queryClient);
    if (answer.response.status !== CONFLICT) return { kind: "failed", key: tableErrorKey(failure) };
    const reason = conflictReason(answer.error);
    return DUPLICATES.has(reason) ? { kind: "duplicate" } : { kind: "conflict", reason };
  } catch (caught) {
    if (guard.isStale()) return { kind: "stale" };
    return { kind: "failed", key: tableErrorKey(caught) };
  }
}
