import { unwrap } from "@wolbachia/api-client";
import { inventoryScopedOptions } from "../inventory-read-context";
import type { InventoryScope } from "../inventory-query";
import type { LabelKind } from "./label-kinds";
import type { LabelItem } from "./label-payload";

export const LABEL_PAGE_SIZE = 100;

export interface LabelPage {
  count: number;
  items: LabelItem[];
}

interface Target {
  kind: LabelKind;
  search: string;
}

async function readLots(scope: InventoryScope, target: Target, signal: AbortSignal) {
  const base = { page: 1, page_size: LABEL_PAGE_SIZE };
  const query = target.search ? { ...base, search: target.search } : base;
  const page = unwrap(await scope.client.GET("/api/v1/lots/", { params: { query }, signal }));
  return {
    count: page.count,
    items: page.results.map((row) => ({
      id: row.id,
      code: row.code,
      caption: row.supply_version.label,
    })),
  };
}

async function readBags(scope: InventoryScope, target: Target, signal: AbortSignal) {
  const base = { page: 1, page_size: LABEL_PAGE_SIZE };
  const query = target.search ? { ...base, search: target.search } : base;
  const page = unwrap(await scope.client.GET("/api/v1/bags/", { params: { query }, signal }));
  return { count: page.count, items: page.results.map((row) => ({ id: row.id, code: row.code })) };
}

async function readOvitraps(scope: InventoryScope, target: Target, signal: AbortSignal) {
  const base = { page: 1, page_size: LABEL_PAGE_SIZE };
  const query = target.search ? { ...base, search: target.search } : base;
  const page = unwrap(await scope.client.GET("/api/v1/ovitraps/", { params: { query }, signal }));
  return {
    count: page.count,
    items: page.results.map((row) => ({ id: row.id, code: row.code, caption: row.point_code })),
  };
}

async function readPaddles(scope: InventoryScope, signal: AbortSignal) {
  const query = { page: 1, page_size: LABEL_PAGE_SIZE };
  const page = unwrap(
    await scope.client.GET("/api/v1/egg-paddles/", { params: { query }, signal }),
  );
  return { count: page.count, items: page.results.map((row) => ({ id: row.id, code: row.code })) };
}

async function readMotorcycles(scope: InventoryScope, signal: AbortSignal) {
  const query = { page: 1, page_size: LABEL_PAGE_SIZE };
  const page = unwrap(
    await scope.client.GET("/api/v1/motorcycles/", { params: { query }, signal }),
  );
  return {
    count: page.count,
    items: page.results.map((row) => ({ id: row.id, code: row.code, caption: row.plate })),
  };
}

function readItems(scope: InventoryScope, target: Target, signal: AbortSignal): Promise<LabelPage> {
  if (target.kind === "lots") return readLots(scope, target, signal);
  if (target.kind === "bags") return readBags(scope, target, signal);
  if (target.kind === "ovitraps") return readOvitraps(scope, target, signal);
  if (target.kind === "paddles") return readPaddles(scope, signal);
  return readMotorcycles(scope, signal);
}

/** One page of records of a label type. Lots, bags and ovitraps search on the server. */
export function labelItemsOptions(scope: InventoryScope, target: Target) {
  return inventoryScopedOptions(scope, {
    key: ["inventory", "labels", target.kind, target.search],
    queryFn: ({ signal }) => readItems(scope, target, signal),
  });
}
