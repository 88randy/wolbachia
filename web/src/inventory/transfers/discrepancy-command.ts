import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { InventoryRateLimit } from "../inventory-failure";

export interface DiscrepancyCommand {
  id: string;
  body: Schemas["CloseDiscrepancyRequest"];
}
/** Close is idempotent by the server's discrepancy/revision/body digest, without a client UUID. */
export async function sendDiscrepancyClose(
  client: ApiClient,
  command: DiscrepancyCommand,
  signal: AbortSignal,
) {
  const reply = await client.POST("/api/v1/discrepancies/{id}/close/", {
    params: { path: { id: command.id } },
    body: command.body,
    signal,
  });
  if (reply.response.status === 429) throw new InventoryRateLimit(reply.response, reply.error);
  return unwrap(reply);
}
