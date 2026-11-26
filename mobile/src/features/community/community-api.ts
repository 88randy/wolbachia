import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";

export type ActivityType = Schemas["SnapshotItem"];
export type ActivityZone = Schemas["CommunityZoneOption"];

export const CATALOG_SLUG = "community-activity-type";
const ZONE_PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 30_000;

/** Active activity types come from the same catalog snapshot the phone downloads for every flow. */
export async function loadActivityTypes(client: ApiClient): Promise<readonly ActivityType[]> {
  const snapshots = unwrap(
    await client.GET("/api/v1/field/catalog/", { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
  );
  const items =
    snapshots
      .flatMap((snapshot) => snapshot.catalogs)
      .find((catalog) => catalog.slug === CATALOG_SLUG)?.items ?? [];
  return [...items].sort(
    (left, right) => Number(left.is_other) - Number(right.is_other) || left.sort - right.sort,
  );
}

/** Only the blocks this user may register activity in (the server scopes the list). */
export async function loadZones(client: ApiClient): Promise<readonly ActivityZone[]> {
  const page = unwrap(
    await client.GET("/api/v1/community-activities/zone-options/", {
      params: { query: { action: "create", page_size: ZONE_PAGE_SIZE } },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
  );
  return page.results;
}

export interface ActivityInput {
  readonly commandId: string;
  readonly typeId: string;
  readonly zoneId: string;
  readonly attendance: number;
  readonly agreements: string;
  readonly otherText: string;
}

/** The command id is generated once per draft, so a retry after a lost answer is idempotent. */
export async function sendActivity(client: ApiClient, input: ActivityInput): Promise<void> {
  unwrap(
    await client.POST("/api/v1/community-activities/", {
      body: {
        command_id: input.commandId,
        type_id: input.typeId,
        zone_id: input.zoneId,
        attendance: input.attendance,
        agreements: input.agreements,
        other_text: input.otherText,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
  );
}
