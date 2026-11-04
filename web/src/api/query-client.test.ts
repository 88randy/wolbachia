import { ApiError } from "@wolbachia/api-client";
import { describe, expect, test } from "vitest";
import { createAppQueryClient, shouldRetry } from "./query-client";

describe("shouldRetry", () => {
  test("retries a network failure a couple of times, then gives up", () => {
    const networkFailure = new TypeError("Failed to fetch");

    expect(shouldRetry(0, networkFailure)).toBe(true);
    expect(shouldRetry(1, networkFailure)).toBe(true);
    expect(shouldRetry(2, networkFailure)).toBe(false);
  });

  test("retries a server error", () => {
    expect(shouldRetry(0, new ApiError(503))).toBe(true);
  });

  test.each([400, 401, 403, 404, 429])("does not retry a %i answer", (status) => {
    expect(shouldRetry(0, new ApiError(status))).toBe(false);
  });
});

describe("createAppQueryClient", () => {
  test("turns retries off for tests", () => {
    const client = createAppQueryClient({ retry: false });

    expect(client.getDefaultOptions().queries?.retry).toBe(false);
  });

  test("uses the retry policy by default", () => {
    const client = createAppQueryClient();

    expect(client.getDefaultOptions().queries?.retry).toBe(shouldRetry);
  });
});
