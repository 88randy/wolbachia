import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
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
  filters: [{ kind: "text", key: "search", maxLength: 100, labelKey: "releases.devices.search" }],
};

export function devicesOptions(client: ApiClient, identity: SessionIdentity, state: TableState) {
  const query = { page: state.page, page_size: DEVICES_PAGE_SIZE, ...toFilterParams(state) };
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "devices", state],
    queryFn: async ({ signal }) =>
      unwrap(await client.GET("/api/v1/release-devices/", { params: { query }, signal })),
  });
}
