import { describe, expect, test } from "vitest";
import type { TableData } from "../data-table/table-types";
import { makeVersion } from "../test/rules-fixtures";
import { hideVoidedVersions } from "./hide-voided-versions";
import type { RuleParameterVersion } from "./rules-query";

const VOIDED = makeVersion({ id: "2", status: "voided", voided_at: "2026-02-01T00:00:00Z" });
const IN_FORCE = makeVersion({ id: "1" });
const SCHEDULED = makeVersion({ id: "3", status: "scheduled" });

function dataOf(rows: RuleParameterVersion[]): TableData<RuleParameterVersion> {
  return {
    rows,
    paging: { mode: "page", page: 1, pageSize: 100, count: rows.length },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: () => undefined,
  };
}

describe("hideVoidedVersions", () => {
  const data = dataOf([SCHEDULED, VOIDED, IN_FORCE]);

  test("leaves the voided versions of the page out and counts them", () => {
    const { data: hidden, hiddenCount } = hideVoidedVersions(data, false);

    expect(hidden.rows.map((version) => version.id)).toEqual(["3", "1"]);
    expect(hiddenCount).toBe(1);
  });

  test("keeps everything, in the same order, when voided versions are included", () => {
    const { data: shown, hiddenCount } = hideVoidedVersions(data, true);

    expect(shown.rows.map((version) => version.id)).toEqual(["3", "2", "1"]);
    expect(hiddenCount).toBe(0);
  });

  test("regression: hiding voided rows never changes the server's total, so page 2 stays reachable", () => {
    // 101 versions at 100 per page, 2 of them voided on page 1: the total must stay 101 (2 pages).
    const page = {
      ...dataOf([VOIDED, VOIDED, IN_FORCE]),
      paging: { mode: "page", page: 1, pageSize: 100, count: 101 },
    } as const;

    const { data: hidden, hiddenCount } = hideVoidedVersions(page, false);

    expect(hidden.paging).toEqual(page.paging);
    expect(hiddenCount).toBe(2);
  });
});
