import { unwrap } from "@wolbachia/api-client";
import type { LabelKind } from "../../labels/label-kinds";
import type { LabelSource } from "../../labels/label-records";
import { inventoryScopedOptions } from "../inventory-read-context";
import type { InventoryScope } from "../inventory-query";

const LABEL_PAGE_SIZE = 100;
/** The bag list serializes lab data per row and is slow on big pages: ask for fewer and search. */
const BAG_PAGE_SIZE = 20;

/** How many records one page of this kind holds. */
export function labelPageSize(kind: LabelKind): number {
  return kind === "bag" ? BAG_PAGE_SIZE : LABEL_PAGE_SIZE;
}

export interface LabelPage {
  count: number;
  sources: LabelSource[];
}

export interface LabelTarget {
  kind: LabelKind;
  /** Free text, searched on the server where the endpoint supports it. */
  search: string;
  /** Exact human code (deep link). Wins over `search`. */
  code?: string;
}

/** Page, size and the exact-code filter; the free-text search only where the endpoint has one. */
function paging(target: LabelTarget, hasSearch: boolean) {
  const base = { page: 1, page_size: labelPageSize(target.kind) };
  if (target.code) return { ...base, code: target.code };
  return hasSearch && target.search ? { ...base, search: target.search } : base;
}

async function readLots(
  scope: InventoryScope,
  target: LabelTarget,
  signal: AbortSignal,
): Promise<LabelPage> {
  const query = paging(target, true);
  const page = unwrap(await scope.client.GET("/api/v1/lots/", { params: { query }, signal }));
  return {
    count: page.count,
    sources: page.results.map((row): LabelSource => ({ kind: "lot", row })),
  };
}

async function readBags(
  scope: InventoryScope,
  target: LabelTarget,
  signal: AbortSignal,
): Promise<LabelPage> {
  const query = paging(target, true);
  const page = unwrap(await scope.client.GET("/api/v1/bags/", { params: { query }, signal }));
  return {
    count: page.count,
    sources: page.results.map((row): LabelSource => ({ kind: "bag", row })),
  };
}

async function readOvitraps(
  scope: InventoryScope,
  target: LabelTarget,
  signal: AbortSignal,
): Promise<LabelPage> {
  const query = paging(target, true);
  const page = unwrap(await scope.client.GET("/api/v1/ovitraps/", { params: { query }, signal }));
  return {
    count: page.count,
    sources: page.results.map((row): LabelSource => ({ kind: "ovitrap", row })),
  };
}

async function readLocations(
  scope: InventoryScope,
  target: LabelTarget,
  signal: AbortSignal,
): Promise<LabelPage> {
  const query = paging(target, true);
  const page = unwrap(await scope.client.GET("/api/v1/locations/", { params: { query }, signal }));
  return {
    count: page.count,
    sources: page.results.map((row): LabelSource => ({ kind: "location", row })),
  };
}

async function readPaddles(
  scope: InventoryScope,
  target: LabelTarget,
  signal: AbortSignal,
): Promise<LabelPage> {
  const query = paging(target, false);
  const page = unwrap(
    await scope.client.GET("/api/v1/egg-paddles/", { params: { query }, signal }),
  );
  return {
    count: page.count,
    sources: page.results.map((row): LabelSource => ({ kind: "paddle", row })),
  };
}

async function readMotorcycles(
  scope: InventoryScope,
  target: LabelTarget,
  signal: AbortSignal,
): Promise<LabelPage> {
  const query = paging(target, false);
  const page = unwrap(
    await scope.client.GET("/api/v1/motorcycles/", { params: { query }, signal }),
  );
  return {
    count: page.count,
    sources: page.results.map((row): LabelSource => ({ kind: "motorcycle", row })),
  };
}

const READERS = {
  lot: readLots,
  bag: readBags,
  paddle: readPaddles,
  ovitrap: readOvitraps,
  motorcycle: readMotorcycles,
  location: readLocations,
} satisfies Record<
  LabelKind,
  (scope: InventoryScope, target: LabelTarget, signal: AbortSignal) => Promise<LabelPage>
>;

/** One page of records of a label kind. Lots, bags, ovitraps and locations search on the server. */
export function labelItemsOptions(scope: InventoryScope, target: LabelTarget) {
  return inventoryScopedOptions(scope, {
    key: ["inventory", "labels", target.kind, target.search, target.code ?? ""],
    queryFn: ({ signal }) => READERS[target.kind](scope, target, signal),
  });
}
