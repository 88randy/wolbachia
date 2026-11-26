import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { CENTER_LOOKUP, QUADRANT_LOOKUP } from "../../lookups/lookup-sources";
import { toFilterParams } from "../../data-table/table-state";
import type { TableQueryConfig, TableState } from "../../data-table/table-types";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { SessionIdentity } from "../../session/org-scoped-query";

export type ReleaseDevice = Schemas["ReleaseDevice"];
export type DeviceStatus = Schemas["ReleaseDeviceStatusEnum"];

/** Same cache root as the permits, so `invalidatePermits` after a write also refreshes devices. */
const ROOT = "permits";
export const DEVICES_PAGE_SIZE = 25;

export const DEVICES_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: DEVICES_PAGE_SIZE,
  defaultOrdering: "code",
  sortableIds: ["code", "created_at"],
  supportsVoided: false,
  filters: [
    { kind: "text", key: "search", maxLength: 100, labelKey: "releases.devices.search" },
    {
      kind: "text",
      key: "center",
      labelKey: "releases.filter.center",
      maxLength: 36,
      input: "lookup",
      lookup: CENTER_LOOKUP,
    },
    {
      kind: "text",
      key: "quadrant",
      labelKey: "releases.filter.quadrant",
      maxLength: 36,
      input: "lookup",
      lookup: QUADRANT_LOOKUP,
    },
  ],
};

export function devicesOptions(client: ApiClient, identity: SessionIdentity, state: TableState) {
  const query = { page: state.page, page_size: DEVICES_PAGE_SIZE, ...toFilterParams(state) };
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "devices", state],
    queryFn: async ({ signal }) =>
      unwrap(await client.GET("/api/v1/release-devices/", { params: { query }, signal })),
  });
}
