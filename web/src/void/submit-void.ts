import { voidFailureOf } from "./void-failure";
import type { VoidFailure } from "./void-failure";

export type VoidResult = { ok: true } | { ok: false; failure: VoidFailure };

interface Answer {
  response: Response;
  error?: unknown;
}

/**
 * Runs one `POST .../void/` call of the typed api-client and reads its answer:
 * `submitVoid(() => client.POST("/api/v1/<resource>/{id}/void/", { params, body: { reason } }))`.
 * A network failure becomes a `service` failure instead of an exception.
 */
export async function submitVoid(call: () => Promise<Answer>): Promise<VoidResult> {
  try {
    const { response, error } = await call();
    if (response.ok) return { ok: true };
    return { ok: false, failure: voidFailureOf(response.status, error) };
  } catch (caught) {
    console.error("The void request failed", caught);
    return { ok: false, failure: { kind: "service", failure: "network" } };
  }
}
