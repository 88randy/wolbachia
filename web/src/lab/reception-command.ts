import { ApiError, unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
export type ReceptionCommand =
  | ({ kind: "bag" } & Schemas["ReceiveBagRequest"])
  | ({ kind: "no_paddle"; id: string } & Schemas["LabCommandRequest"])
  | ({ kind: "missing"; id: string } & Schemas["MissingBagRequest"]);
export interface ReceptionResult {
  code: string;
  subject?: string;
  incidentId?: string | null;
  discrepancyId?: string;
  receipt?: Schemas["LabReceptionOutcome"];
}
/** Only framing whitespace/control characters are discarded; QR payload syntax is pending. */
export function normalizeBagCode(value: string): string {
  return value.replace(/\p{Cc}/gu, "").trim();
}
export function isBagCodeValid(value: string): boolean {
  return value.length > 0 && value.length <= 50;
}
/** A domain conflict may contain a real retained discrepancy; never infer an incident. */
function receptionReply(result: {
  response: Response;
  data?: Schemas["LabReceptionOutcome"];
  error?: Schemas["LabReceptionConflict"] | Schemas["ErrorEnvelope"];
}): ReceptionResult {
  if (result.response.ok)
    return {
      code: result.data?.receipt.kind === "no_paddle" ? "no_paddle" : "received",
      receipt: result.data,
    };
  const failure = result.error;
  if (result.response.status === 409 && failure)
    return {
      code: failure.code,
      incidentId: "incident_id" in failure ? failure.incident_id : undefined,
      discrepancyId: "discrepancy_id" in failure ? failure.discrepancy_id : undefined,
    };
  unwrap(result);
  throw new ApiError(result.response.status);
}
/** Each explicit attempt has one immutable command UUID; no automatic replay. */
export async function postReception(
  client: ApiClient,
  command: ReceptionCommand,
  signal: AbortSignal,
): Promise<ReceptionResult> {
  if (command.kind === "missing")
    return receptionReply(
      await client.POST("/api/v1/bags/{id}/mark-missing/", {
        params: { path: { id: command.id } },
        body: { command_id: command.command_id, reason: command.reason },
        signal,
      }),
    );
  if (command.kind === "no_paddle")
    return receptionReply(
      await client.POST("/api/v1/readings/{id}/receive/", {
        params: { path: { id: command.id } },
        body: { command_id: command.command_id },
        signal,
      }),
    );
  return receptionReply(
    await client.POST("/api/v1/bags/receive/", {
      body: { code: command.code, command_id: command.command_id },
      signal,
    }),
  );
}
