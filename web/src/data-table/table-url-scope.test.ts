import { expect, test } from "vitest";
import { scopedTableSearch, scopedTablePatch } from "./table-url-scope";
import { readTableState, applyPatch, patchForFilter } from "./table-state";
import { historyTable } from "../quadrants/geography/history-table";
const AUTHOR = "00000000-0000-4000-8000-000000000001";
test("a history reads/writes its own namespace without borrowing or resetting parent list state", () => {
  const search = {
    view: "points",
    page: "3",
    search: "parent",
    ordering: "code",
    history_page: "2",
    history_ordering: "-version",
    history_version: "7",
    history_unexpected: "x",
  };
  const parsed = readTableState(
    scopedTableSearch(search, { prefix: "history_" }),
    historyTable(true, AUTHOR),
  );
  expect(parsed.state).toMatchObject({
    page: 2,
    sort: { id: "version", direction: "desc" },
    filters: { version: "7" },
  });
  expect(parsed.ignored).toEqual(["unexpected"]);
  const next = applyPatch(search, scopedTablePatch(patchForFilter("version", "8"), "history_"));
  expect(next).toMatchObject({
    view: "points",
    page: "3",
    search: "parent",
    ordering: "code",
    history_version: "8",
  });
  expect(next["history_page"]).toBeUndefined();
});
test.each(["0", "-1", "1.2", "no", "9007199254740992"])(
  "history rejects unsafe positive revision %s before constructing API numbers",
  (revision) => {
    const parsed = readTableState({ revision, created_by: AUTHOR }, historyTable(false, AUTHOR));
    expect(parsed.state.filters).toEqual({ created_by: AUTHOR });
    expect(parsed.ignored).toEqual(["revision"]);
  },
);
