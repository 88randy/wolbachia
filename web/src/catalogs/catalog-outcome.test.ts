import { QueryClient } from "@tanstack/react-query";
import { expect, test } from "vitest";
import { catalogFailure, sendCatalogWrite } from "./catalog-outcome";
import { bumpEpoch, currentRevision } from "../session/session-revision";
test.each([
  ["duplicate_code", "code", "catalogs.error.duplicate"],
  ["reserved_code", "code", "catalogs.error.reserved"],
  ["sort_exhausted", "sort", "catalogs.error.sort"],
])("maps %s without showing server detail", (code, field, key) => {
  const result = catalogFailure(400, {
    code: "validation_error",
    detail: "Never show me",
    fields: { [field]: [{ code, params: {} }] },
  });
  expect(result).toMatchObject({
    kind: "failed",
    ...(field === "sort" ? { key } : { fields: { [field]: key } }),
  });
});
test.each([
  ["other_item_cannot_be_deactivated", "catalogs.error.other"],
  ["other_item_protected", "catalogs.error.other"],
  ["catalog_item_limit_reached", "catalogs.error.limit"],
  ["catalog_version_conflict", "catalogs.error.versionConflict"],
])("maps conflict %s", (code, key) => {
  expect(catalogFailure(409, { code, detail: "Never show me" })).toMatchObject({
    kind: "failed",
    key,
  });
});
test("a late 401 after a session revision change is silently dropped", async () => {
  let resolve!: (answer: { response: Response }) => void;
  const pending = new Promise<{ response: Response }>((done) => {
    resolve = done;
  });
  const revision = currentRevision();
  const queryClient = new QueryClient();
  const result = sendCatalogWrite(
    queryClient,
    () => pending,
    () => revision !== currentRevision(),
  );
  bumpEpoch();
  resolve({ response: new Response(null, { status: 401 }) });
  expect(await result).toEqual({ kind: "stale" });
  expect(queryClient.getQueryCache().getAll()).toEqual([]);
});
