/* eslint-disable max-lines-per-function -- presentational/composition unit; splitting it into one-use fragments would hurt readability. */
import { infiniteQueryOptions } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { ORG_SCOPE, orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";

export type HomeSummary = Schemas["HomeSummary"];
export type SearchResponse = Schemas["SearchResponse"];
export type SearchGroup = SearchResponse["groups"][number];
export type HistoryEntry = Schemas["TimelineEntry"];
export type RecordType = Schemas["TypeEnum"];

const SUMMARY_REFRESH_MS = 60_000;
const HISTORY_PAGE_SIZE = 25;

export const RECORD_TYPES: readonly RecordType[] = [
  "incident",
  "motorcycle",
  "quadrant",
  "sampling_point",
  "shipment",
];

export function isRecordType(value: string | undefined): value is RecordType {
  return RECORD_TYPES.some((type) => type === value);
}

export function homeSummaryOptions(client: ApiClient, identity: SessionIdentity) {
  return {
    ...orgScopedQueryOptions(identity, {
      key: ["home", "summary"],
      queryFn: async ({ signal }) => unwrap(await client.GET("/api/v1/home/summary/", { signal })),
    }),
    refetchInterval: SUMMARY_REFRESH_MS,
  };
}

export interface SearchRequest {
  q: string;
  type: RecordType | undefined;
  includeVoided: boolean;
  page: number;
  pageSize: number;
}

export function searchOptions(
  client: ApiClient,
  identity: SessionIdentity,
  request: SearchRequest,
) {
  const query = {
    q: request.q,
    include_voided: request.includeVoided,
    page: request.page,
    page_size: request.pageSize,
    ...(request.type === undefined ? {} : { type: request.type }),
  };
  return orgScopedQueryOptions(identity, {
    key: ["discovery", "search", query],
    queryFn: async ({ signal }) =>
      unwrap(await client.GET("/api/v1/search/", { params: { query }, signal })),
  });
}

/** The history of one record, newest first, loaded by cursor. */
export function historyOptions(
  client: ApiClient,
  identity: SessionIdentity,
  record: { type: string; code: string },
) {
  return infiniteQueryOptions({
    queryKey: [
      ORG_SCOPE,
      identity.userId,
      identity.organizationSlug,
      "discovery",
      "history",
      record,
    ],
    enabled: identity.isSettled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ signal, pageParam }) =>
      unwrap(
        await client.GET("/api/v1/records/{record_type}/{code}/history/", {
          params: {
            path: { record_type: record.type, code: record.code },
            query: {
              page_size: HISTORY_PAGE_SIZE,
              ...(pageParam === undefined ? {} : { cursor: pageParam }),
            },
          },
          signal,
        }),
      ),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}
