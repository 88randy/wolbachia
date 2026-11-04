import { ApiError, isErrorEnvelope } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { reportSessionError } from "../session/session-events";
import { voidFailureOf } from "./void-failure";
import type { VoidFailure } from "./void-failure";

export type VoidResult = { ok: true } | { ok: false; failure: VoidFailure };

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
 * failure instead of an exception.
 */
export async function submitVoid(
  queryClient: QueryClient,
  call: () => Promise<Answer>,
): Promise<VoidResult> {
  try {
    const { response, error } = await call();
    if (response.ok) return { ok: true };
    const envelope = isErrorEnvelope(error) ? error : undefined;
    reportSessionError(new ApiError(response.status, envelope), queryClient);
    return { ok: false, failure: voidFailureOf(response.status, error) };
  } catch (caught) {
    console.error("The void request failed", caught);
    return { ok: false, failure: { kind: "service", failure: "network" } };
  }
}
