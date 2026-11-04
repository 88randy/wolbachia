import { ApiError } from "@wolbachia/api-client";
import { describe, expect, test, vi } from "vitest";
import { cursorTableData, pageTableData } from "./table-data";
import { tableErrorKey } from "./table-error";

interface QueryOverrides {
  isPending?: boolean;
  isFetching?: boolean;
  error?: Error | null;
  refetch?: () => unknown;
}

function queryOf<Answer>(data: Answer | undefined, overrides: QueryOverrides = {}) {
  return {
    data,
    isPending: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

interface Row {
  id: string;
}

describe("pageTableData", () => {
  test("before the first answer there are no rows and no paging, and it is loading", () => {
    const query = queryOf<{ count: number; results: Row[] }>(undefined, {
      isPending: true,
      isFetching: true,
    });

    expect(pageTableData(query, 1, 25)).toMatchObject({
      rows: [],
      paging: undefined,
      isLoading: true,
      isFetching: true,
    });
  });

  test("takes rows and the count from the answer", () => {
    const answer = { count: 53, next: null, previous: null, results: [{ id: "a" }] };

    const data = pageTableData(queryOf(answer), 2, 25);

    expect(data.rows).toEqual([{ id: "a" }]);
    expect(data.paging).toEqual({ mode: "page", page: 2, pageSize: 25, count: 53 });
    expect(data.isLoading).toBe(false);
  });

  test("a failure is not 'loading' and refetch asks again", () => {
    const refetch = vi.fn();
    const error = new Error("boom");
    const query = queryOf<{ count: number; results: Row[] }>(undefined, {
      error,
      refetch,
      isPending: true,
    });

    const data = pageTableData(query, 1, 25);
    data.refetch();

    expect(data.isLoading).toBe(false);
    expect(data.error).toBe(error);
    expect(refetch).toHaveBeenCalledOnce();
  });
});

describe("cursorTableData", () => {
  test("keeps the links of the answer for the pager", () => {
    const answer = { next: "http://api/x/?cursor=a", previous: null, results: [{ id: "a" }] };

    const data = cursorTableData(queryOf(answer));

    expect(data.paging).toEqual({ mode: "cursor", next: "http://api/x/?cursor=a", previous: null });
  });
});

describe("tableErrorKey", () => {
  test.each([
    [new TypeError("Failed to fetch"), "errors.api.network"],
    [new ApiError(403, undefined), "errors.api.permissionDenied"],
    [new ApiError(404, undefined), "errors.api.notFound"],
    [new ApiError(429, undefined), "errors.api.rateLimited"],
    [new ApiError(502, undefined), "errors.api.serverError"],
    [new ApiError(400, undefined), "errors.api.generic"],
    [new Error("anything else"), "errors.api.generic"],
  ])("%s maps to %s", (error, key) => {
    expect(tableErrorKey(error)).toBe(key);
  });
});
