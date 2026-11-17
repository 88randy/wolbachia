import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { inventoryScopedOptions } from "../inventory-read-context";
import type { InventoryScope } from "../inventory-query";

/** Part of the key of the unplaced-labels read; writers invalidate by it. */
export const OVITRAP_POOL_KEY = "ovitrap-pool";

/** Stickers already registered whose ovitrap is not placed yet: they can be printed again. */
export function unplacedOvitrapLabelsOptions(scope: InventoryScope, isEnabled: boolean) {
  const options = inventoryScopedOptions(scope, {
    key: ["inventory", "labels", OVITRAP_POOL_KEY],
    queryFn: async ({ signal }) =>
      unwrap(await scope.client.GET("/api/v1/ovitrap-labels/unplaced/", { signal })).labels,
  });
  return { ...options, enabled: options.enabled && isEnabled };
}

/** Registers `count` new stickers (code and QR identity are made by the server). */
export async function mintOvitrapLabels(
  scope: InventoryScope,
  count: number,
  signal: AbortSignal,
): Promise<Schemas["OvitrapLabel"][]> {
  const body = unwrap(
    await scope.client.POST("/api/v1/ovitrap-labels/", { body: { count }, signal }),
  );
  return body.labels;
}
