import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { InventoryRateLimit } from "./inventory-failure";
import type { InventoryRecord } from "./inventory-links";
export type InventoryCommand =
  | { kind: "supply"; id?: string; body: Schemas["SupplyWriteRequest"] }
  | { kind: "lot"; id?: string; body: Schemas["LotWriteRequest"] }
  | { kind: "location"; id?: string; body: Schemas["LocationWriteRequest"] }
  | { kind: "deactivate"; id: string; body: Schemas["InventoryRevisionRequest"] };
export type InventoryFormCommand = Exclude<InventoryCommand, { kind: "deactivate" }>;
/** Each command is a single explicit generated API operation, never an automatic replay. */
export async function sendInventoryCommand(
  client: ApiClient,
  command: InventoryCommand,
  signal: AbortSignal,
) {
  return unwrapInventoryReply<InventoryRecord>(await inventoryReply(client, command, signal));
}
function unwrapInventoryReply<T>(reply: { response: Response; data?: T; error?: unknown }) {
  if (reply.response.status === 429) throw new InventoryRateLimit(reply.response, reply.error);
  return unwrap(reply);
}
async function inventoryReply(client: ApiClient, command: InventoryCommand, signal: AbortSignal) {
  const params = { path: { id: command.id ?? "" } };
  if (command.kind === "deactivate")
    return client.POST("/api/v1/supply-types/{id}/deactivate/", {
      params,
      body: command.body,
      signal,
    });
  if (command.kind === "supply")
    return command.id
      ? client.PATCH("/api/v1/supply-types/{id}/", { params, body: command.body, signal })
      : client.POST("/api/v1/supply-types/", { body: command.body, signal });
  if (command.kind === "location")
    return command.id
      ? client.PATCH("/api/v1/locations/{id}/", { params, body: command.body, signal })
      : client.POST("/api/v1/locations/", { body: command.body, signal });
  return command.id
    ? client.PATCH("/api/v1/lots/{id}/", { params, body: command.body, signal })
    : client.POST("/api/v1/lots/", { body: command.body, signal });
}
