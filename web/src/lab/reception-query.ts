import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { QueryFunction } from "@tanstack/react-query";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import type { TableState } from "../data-table/table-types";
import { RECEPTION_PAGE_SIZE } from "./reception-table";
import type { ReceptionView } from "./reception-table";
export interface ReceptionScope {
  client: ApiClient;
  identity: SessionIdentity;
}
export interface ReceptionRow {
  id: string;
  bagId: string | null;
  readingId: string | null;
  code: string | null;
  createdAt: string;
  status: string;
  discrepancy?: Schemas["LabDiscrepancy"];
}
/** Centralized keys retain the shared session guard and placeholder policy. */
export function labScopeOptions<T>(
  scope: ReceptionScope,
  key: readonly unknown[],
  queryFn: QueryFunction<T>,
) {
  return orgScopedQueryOptions(scope.identity, { key: ["lab-reception", ...key], queryFn });
}
export function receptionFilters(state: TableState) {
  return {
    code: state.filters["code"],
    point: state.filters["point"],
    week: state.filters["week"],
  };
}
function receiptRow(receipt: Schemas["LabReceipt"]): ReceptionRow {
  return {
    id: receipt.id,
    bagId: receipt.bag_id,
    readingId: receipt.reading_id,
    code: null,
    createdAt: receipt.created_at,
    status: receipt.kind === "no_paddle" ? "noPaddle" : "received",
  };
}
function expectedRow(bag: Schemas["Bag"]): ReceptionRow {
  return {
    id: bag.id,
    bagId: bag.id,
    readingId: bag.reading,
    code: bag.code,
    createdAt: bag.created_at,
    status: bag.lab?.status ?? "expected",
  };
}
function discrepancyRow(discrepancy: Schemas["LabDiscrepancy"]): ReceptionRow {
  return {
    id: discrepancy.id,
    bagId: discrepancy.bag_id,
    readingId: null,
    code: null,
    createdAt: discrepancy.created_at,
    status: discrepancy.kind,
    discrepancy,
  };
}
/** Filter/order/page on the server; normalize only the visible page's presentation. */
export function receptionListOptions(
  scope: ReceptionScope,
  state: TableState,
  view: ReceptionView,
) {
  const query = {
    ...receptionFilters(state),
    page: state.page,
    page_size: RECEPTION_PAGE_SIZE,
    ordering: state.sort?.direction === "asc" ? ("created_at" as const) : ("-created_at" as const),
  };
  return labScopeOptions(scope, [view, state], async ({ signal }) => {
    if (view === "expected") return readExpectedPage(scope.client, { query, signal });
    if (view === "discrepancies") return readDiscrepancyPage(scope.client, { query, signal });
    const page = unwrap(
      await scope.client.GET("/api/v1/lab-receptions/", {
        params: { query: { ...query, kind: view === "noPaddle" ? "no_paddle" : "bag" } },
        signal,
      }),
    );
    return { count: page.count, results: page.results.map(receiptRow) };
  });
}
async function readDiscrepancyPage(
  client: ApiClient,
  options: Parameters<typeof readExpectedPage>[1],
) {
  const page = unwrap(
    await client.GET("/api/v1/lab-reception-discrepancies/", {
      params: { query: options.query },
      signal: options.signal,
    }),
  );
  return { count: page.count, results: page.results.map(discrepancyRow) };
}
async function readExpectedPage(
  client: ApiClient,
  options: {
    query: ReturnType<typeof receptionFilters> & {
      page: number;
      page_size: number;
      ordering: "created_at" | "-created_at";
    };
    signal: AbortSignal;
  },
) {
  const page = unwrap(
    await client.GET("/api/v1/bags/", {
      params: { query: { ...options.query, lab_status: "expected", status: "active" } },
      signal: options.signal,
    }),
  );
  return { count: page.count, results: page.results.map(expectedRow) };
}
export function receptionCountOptions(
  scope: ReceptionScope,
  state: TableState,
  kind: "received" | "expected",
) {
  const query = { ...receptionFilters(state), page_size: 1 };
  return labScopeOptions(scope, ["count", kind, query], async ({ signal }) => {
    if (kind === "expected")
      return unwrap(
        await scope.client.GET("/api/v1/bags/", {
          params: { query: { ...query, status: "active", lab_status: "expected" } },
          signal,
        }),
      ).count;
    return unwrap(
      await scope.client.GET("/api/v1/lab-receptions/", {
        params: { query: { ...query, kind: "bag" } },
        signal,
      }),
    ).count;
  });
}
