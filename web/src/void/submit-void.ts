import { ApiError, isErrorEnvelope } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { reportSessionError } from "../session/session-events";
import { voidFailureOf } from "./void-failure";
import type { VoidFailure } from "./void-failure";

export type VoidResult = { ok: true } | { ok: false; failure: VoidFailure };

/**
 * What a caller gets when `isStale()` says the answer belongs to another session (or the dialog
 * is gone): a quiet failure, nothing is reported to the session.
 */
const STALE: VoidResult = { ok: false, failure: { kind: "service", failure: "network" } };

interface Answer {
  response: Response;
  error?: unknown;
}

/**
 * Runs one `POST .../void/` call of the typed api-client and reads its answer:
 * `submitVoid(queryClient, () => client.POST("/api/v1/<resource>/{id}/void/", { params, body }))`.
 * A failed answer is first reported to the session, exactly as the query and mutation caches do
 * for every other request, so an expired session (401) or a lost membership (403
 * `no_active_membership`) still opens the re-authentication dialog or leaves the organization;
 * then it is read as a void failure for the dialog. A network failure becomes a `service`
 * failure instead of an exception. `isStale` (optional, from `useSessionGuard`) drops an answer
 * of a closed session before it is reported.
 */
export async function submitVoid(
  queryClient: QueryClient,
  call: () => Promise<Answer>,
  isStale: () => boolean = () => false,
): Promise<VoidResult> {
  try {
    const { response, error } = await call();
    if (isStale()) return STALE;
    if (response.ok) return { ok: true };
    const envelope = isErrorEnvelope(error) ? error : undefined;
    reportSessionError(new ApiError(response.status, envelope), queryClient);
    return { ok: false, failure: voidFailureOf(response.status, error) };
  } catch (caught) {
    if (isStale()) return STALE;
    console.error("The void request failed", caught);
    return { ok: false, failure: { kind: "service", failure: "network" } };
  }
}
