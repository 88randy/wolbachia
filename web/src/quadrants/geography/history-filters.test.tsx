import { expect, test } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import type { TableState } from "../../data-table/table-types";
import { createFakeApi } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import { createWebApiClient } from "../../api/create-web-api-client";
import { sessionIdentityOf } from "../../session/org-scoped-query";
import { currentRevision } from "../../session/session-revision";
import { readTableState } from "../../data-table/table-state";
import { scopedTableSearch } from "../../data-table/table-url-scope";
import { historyTable } from "./history-table";
import { historyOptions, blockHistoryOptions, pointHistoryOptions } from "./geography-query";
import { ALLOWED, QUADRANT_ID, BLOCK_ID, POINT_ID, pageOf } from "./geography-test-helpers";
import type { GeographyScope } from "./use-w-15";
interface Case {
  resource: string;
  id: string;
  isPoint: boolean;
  read: (query: QueryClient, scope: GeographyScope, state: TableState) => Promise<void>;
}
const CASES: Case[] = [
  {
    resource: "quadrants",
    id: QUADRANT_ID,
    isPoint: false,
    read: async (query, scope, state) => {
      await query.query(historyOptions(scope, QUADRANT_ID, state));
    },
  },
  {
    resource: "blocks",
    id: BLOCK_ID,
    isPoint: false,
    read: async (query, scope, state) => {
      await query.query(blockHistoryOptions(scope, BLOCK_ID, state));
    },
  },
  {
    resource: "sampling-points",
    id: POINT_ID,
    isPoint: true,
    read: async (query, scope, state) => {
      await query.query(pointHistoryOptions(scope, POINT_ID, state));
    },
  },
];
test.each(CASES)(
  "$resource history forwards only its typed version/author/time/status contract",
  async ({ resource, id, isPoint, read }) => {
    const endpoint = `/api/v1/${resource}/${id}/versions/`;
    const api = createFakeApi({
      "GET /api/v1/me/": () => Response.json(ALLOWED),
      "GET /api/v1/centers/": () => pageOf(),
      [`GET ${endpoint}`]: () => pageOf(),
    });
    const app = await renderApp({ fetch: api.fetch });
    const scope: GeographyScope = {
      me: ALLOWED,
      client: createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch }),
      identity: sessionIdentityOf(ALLOWED, currentRevision(), true),
      context: "authorized-test",
      canRead: true,
      canPublish: false,
      canCreatePoint: false,
      canCreateQuadrant: false,
    };
    const field = isPoint ? "version" : "revision";
    const raw = {
      view: "points",
      page: "4",
      search: "parent",
      ordering: "code",
      history_page: "2",
      history_ordering: `-${field}`,
      [`history_${field}`]: "3",
      history_created_by: ALLOWED.user.id,
      history_effective_from_from: "2026-01-01T00:00:00Z",
      history_effective_from_before: "2026-12-01T00:00:00Z",
      ...(isPoint ? { history_is_retired: "true" } : {}),
    };
    const { state } = readTableState(
      scopedTableSearch(raw, { prefix: "history_" }),
      historyTable(isPoint, ALLOWED.user.id),
    );
    await read(app.queryClient, scope, state);
    const request = api.requests.find((entry) => entry.path.startsWith(endpoint));
    const query = new URL(request?.path ?? "", "http://api.invalid").searchParams;
    expect(Object.fromEntries(query)).toEqual({
      page: "2",
      page_size: "25",
      ordering: `-${field}`,
      [field]: "3",
      created_by: ALLOWED.user.id,
      effective_from_from: "2026-01-01T00:00:00Z",
      effective_from_before: "2026-12-01T00:00:00Z",
      ...(isPoint ? { is_retired: "true" } : {}),
    });
  },
);
