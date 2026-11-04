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

  test("leaves the voided versions out and the total with them", () => {
    const hidden = hideVoidedVersions(data, false);

    expect(hidden.rows.map((version) => version.id)).toEqual(["3", "1"]);
    expect(hidden.paging).toMatchObject({ count: 2 });
  });

  test("keeps everything, in the same order, when voided versions are included", () => {
    const shown = hideVoidedVersions(data, true);

    expect(shown.rows.map((version) => version.id)).toEqual(["3", "2", "1"]);
    expect(shown.paging).toMatchObject({ count: 3 });
  });

  test("does not touch the data while nothing has arrived", () => {
    const loading = { ...dataOf([]), paging: undefined, isLoading: true };

    expect(hideVoidedVersions(loading, false)).toEqual(loading);
  });
});
