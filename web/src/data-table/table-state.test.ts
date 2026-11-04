import { describe, expect, test } from "vitest";
import {
  applyPatch,
  cursorOfLink,
  nextOrdering,
  pageCountOf,
  pagerPlanOf,
  patchForClearFilters,
  patchForFilter,
  patchForIgnored,
  patchForPage,
  rangeOf,
  readTableState,
  toFilterParams,
} from "./table-state";
import type { TableQueryConfig } from "./table-types";

const BASE_CONFIG: TableQueryConfig = {
  paging: "page",
  pageSize: 20,
  supportsVoided: true,
  sortableIds: ["created_at", "code"],
  filters: [
    {
      kind: "select",
      key: "status",
      labelKey: "table.filters.label",
      options: [
        { value: "open", labelKey: "table.filters.all" },
        { value: "closed", labelKey: "table.filters.all" },
      ],
    },
    { kind: "text", key: "code", labelKey: "table.filters.label", maxLength: 10 },
  ],
};

const PAGE_CONFIG: TableQueryConfig = { ...BASE_CONFIG, defaultOrdering: "-created_at" };
const CURSOR_CONFIG: TableQueryConfig = { ...BASE_CONFIG, paging: "cursor", supportsVoided: false };

describe("readTableState", () => {
  test("an empty URL gives the first page, the default order and no filters", () => {
    const { state, ignored } = readTableState({}, PAGE_CONFIG);

    expect(state).toEqual({
      page: 1,
      cursor: null,
      sort: { id: "created_at", direction: "desc" },
      isSortExplicit: false,
      filters: {},
      includeVoided: false,
    });
    expect(ignored).toEqual([]);
  });

  test("reads the format of the issue: ?status=open&ordering=-created_at&page=2", () => {
    const { state, ignored } = readTableState(
      { status: "open", ordering: "-created_at", page: "2" },
      PAGE_CONFIG,
    );

    expect(state.filters).toEqual({ status: "open" });
    expect(state.sort).toEqual({ id: "created_at", direction: "desc" });
    expect(state.isSortExplicit).toBe(true);
    expect(state.page).toBe(2);
    expect(ignored).toEqual([]);
  });

  test("an ascending order has no minus sign", () => {
    expect(readTableState({ ordering: "code" }, PAGE_CONFIG).state.sort).toEqual({
      id: "code",
      direction: "asc",
    });
  });

  test("an unknown parameter is ignored and named", () => {
    const { state, ignored } = readTableState({ colour: "red", status: "open" }, PAGE_CONFIG);

    expect(ignored).toEqual(["colour"]);
    expect(state.filters).toEqual({ status: "open" });
  });

  test.each([
    ["a select value that is not an option", { status: "banana" }, "status"],
    ["an ordering by a column that cannot sort", { ordering: "secret" }, "ordering"],
    ["a malformed ordering", { ordering: "--created_at" }, "ordering"],
    ["a page that is not a number", { page: "abc" }, "page"],
    ["page zero", { page: "0" }, "page"],
    ["a negative page", { page: "-3" }, "page"],
    ["a huge page", { page: "99999999999" }, "page"],
    ["a text longer than the limit", { code: "x".repeat(11) }, "code"],
    ["include_voided on a table that cannot", { include_voided: "true" }, "include_voided"],
  ])("%s is ignored and named", (_name, search, name) => {
    const config =
      name === "include_voided" ? { ...PAGE_CONFIG, supportsVoided: false } : PAGE_CONFIG;
    const { state, ignored } = readTableState(search, config);

    expect(ignored).toEqual([name]);
    expect(state.page).toBe(1);
    expect(state.filters).toEqual({});
    expect(state.includeVoided).toBe(false);
    expect(state.isSortExplicit).toBe(false);
  });

  test("an invalid ordering falls back to the default order", () => {
    expect(readTableState({ ordering: "secret" }, PAGE_CONFIG).state.sort).toEqual({
      id: "created_at",
      direction: "desc",
    });
  });

  test("text filters are trimmed and keep exactly what was typed", () => {
    expect(readTableState({ code: "  1e3 " }, PAGE_CONFIG).state.filters).toEqual({ code: "1e3" });
  });

  test("a blank text filter is dropped without a notice", () => {
    const { state, ignored } = readTableState({ code: "   " }, PAGE_CONFIG);

    expect(state.filters).toEqual({});
    expect(ignored).toEqual([]);
  });

  test("a number or boolean already coerced by a route reads as its text; an object is not read", () => {
    const { state } = readTableState(
      { status: { a: 1 }, page: 2, include_voided: true },
      PAGE_CONFIG,
    );

    expect(state.filters).toEqual({});
    expect(state.page).toBe(2);
    expect(state.includeVoided).toBe(true);
  });

  test("include_voided=true is read when the table supports it", () => {
    expect(readTableState({ include_voided: "true" }, PAGE_CONFIG).state.includeVoided).toBe(true);
  });

  test("cursor mode reads the cursor and ignores page", () => {
    const { state, ignored } = readTableState({ cursor: "cD0yMDI2", page: "3" }, CURSOR_CONFIG);

    expect(state.cursor).toBe("cD0yMDI2");
    expect(state.page).toBe(1);
    expect(ignored).toEqual(["page"]);
  });

  test("page mode ignores a cursor", () => {
    const { state, ignored } = readTableState({ cursor: "abc" }, PAGE_CONFIG);

    expect(state.cursor).toBeNull();
    expect(ignored).toEqual(["cursor"]);
  });

  test("an empty or control-character cursor is ignored", () => {
    expect(readTableState({ cursor: "" }, CURSOR_CONFIG).ignored).toEqual(["cursor"]);
    expect(readTableState({ cursor: "a\u0000b" }, CURSOR_CONFIG).ignored).toEqual(["cursor"]);
  });
});

describe("patches", () => {
  test("changing a filter resets the page and the cursor", () => {
    const next = applyPatch(
      { page: "3", cursor: "x", ordering: "code" },
      patchForFilter("status", "open"),
    );

    expect(next).toEqual({ ordering: "code", status: "open" });
  });

  test("an undefined value removes the key", () => {
    expect(applyPatch({ status: "open", page: "2" }, patchForFilter("status", undefined))).toEqual(
      {},
    );
  });

  test("clearing the filters keeps the order and the voided toggle", () => {
    const next = applyPatch(
      { status: "open", code: "A1", ordering: "code", include_voided: "true", page: "2" },
      patchForClearFilters(PAGE_CONFIG),
    );

    expect(next).toEqual({ ordering: "code", include_voided: "true" });
  });

  test("page 1 is not written to the URL", () => {
    expect(applyPatch({ page: "2" }, patchForPage(1))).toEqual({});
    expect(applyPatch({}, patchForPage(4))).toEqual({ page: "4" });
  });

  test("dropping the ignored parameters removes only them", () => {
    expect(applyPatch({ colour: "red", status: "open" }, patchForIgnored(["colour"]))).toEqual({
      status: "open",
    });
  });
});

describe("nextOrdering", () => {
  const none = null;

  test("a first click sorts ascending, a second descending", () => {
    expect(nextOrdering(none, "code", undefined)).toBe("code");
    expect(nextOrdering({ id: "code", direction: "asc" }, "code", undefined)).toBe("-code");
  });

  test("a third click goes back to the default order", () => {
    expect(nextOrdering({ id: "code", direction: "desc" }, "code", "-created_at")).toBeUndefined();
  });

  test("on the column that is the default, descending goes to ascending", () => {
    expect(nextOrdering({ id: "created_at", direction: "desc" }, "created_at", "-created_at")).toBe(
      "created_at",
    );
  });

  test("another column starts ascending", () => {
    expect(nextOrdering({ id: "code", direction: "desc" }, "created_at", undefined)).toBe(
      "created_at",
    );
  });
});

describe("toFilterParams", () => {
  test("sends filters, an explicit ordering and include_voided with the names of the URL", () => {
    const { state } = readTableState(
      { status: "open", ordering: "-code", include_voided: "true", page: "2" },
      PAGE_CONFIG,
    );

    expect(toFilterParams(state)).toEqual({
      status: "open",
      ordering: "-code",
      include_voided: true,
    });
  });

  test("does not send the default order: the API applies it", () => {
    expect(toFilterParams(readTableState({}, PAGE_CONFIG).state)).toEqual({});
  });
});

describe("cursorOfLink", () => {
  test("reads the cursor of a DRF link", () => {
    expect(cursorOfLink("http://api.test/api/v1/review-items/?cursor=cD0xMjM%3D&kind=x")).toBe(
      "cD0xMjM=",
    );
  });

  test("works with a relative link", () => {
    expect(cursorOfLink("/api/v1/review-items/?cursor=abc")).toBe("abc");
  });

  test("a missing link or one without a cursor gives null", () => {
    expect(cursorOfLink(null)).toBeNull();
    expect(cursorOfLink("/api/v1/review-items/")).toBeNull();
  });
});

describe("pagerPlanOf", () => {
  test("page mode offers previous and next around the current page, and the position", () => {
    expect(pagerPlanOf({ mode: "page", page: 2, pageSize: 20, count: 53 })).toEqual({
      previous: { kind: "page", page: 1 },
      next: { kind: "page", page: 3 },
      position: { page: 2, pages: 3 },
    });
  });

  test("no previous on the first page and no next on the last", () => {
    const first = pagerPlanOf({ mode: "page", page: 1, pageSize: 20, count: 53 });
    const last = pagerPlanOf({ mode: "page", page: 3, pageSize: 20, count: 53 });

    expect(first.previous).toBeNull();
    expect(last.next).toBeNull();
  });

  test("cursor mode: a link without a cursor is the first page, no link is no page", () => {
    expect(
      pagerPlanOf({ mode: "cursor", next: "/api/v1/x/?cursor=abc", previous: "/api/v1/x/" }),
    ).toEqual({
      previous: { kind: "cursor", cursor: null },
      next: { kind: "cursor", cursor: "abc" },
      position: null,
    });
    expect(pagerPlanOf({ mode: "cursor", next: null, previous: null })).toMatchObject({
      previous: null,
      next: null,
    });
  });
});

describe("paging arithmetic", () => {
  test("page count is at least one", () => {
    expect(pageCountOf(0, 20)).toBe(1);
    expect(pageCountOf(41, 20)).toBe(3);
  });

  test("range of the rows on a page", () => {
    expect(rangeOf(2, 20, 20)).toEqual({ from: 21, to: 40 });
    expect(rangeOf(3, 20, 1)).toEqual({ from: 41, to: 41 });
    expect(rangeOf(1, 20, 0)).toEqual({ from: 0, to: 0 });
  });
});
