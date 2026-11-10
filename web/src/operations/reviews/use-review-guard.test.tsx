import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { createApiClient } from "@wolbachia/api-client";
import { useReviewGuard } from "./use-review-guard";

vi.mock("../../session/use-session-guard", () => ({
  useSessionGuard: () => () => ({ signal: new AbortController().signal, isStale: () => false }),
}));

test("an authorization A/B/A change retires the original command entry", () => {
  const client = createApiClient({
    baseUrl: "https://test.invalid",
    auth: { kind: "session", getCsrfToken: () => undefined },
  });
  const identity = { userId: "reviewer", organizationSlug: "test", revision: 1, isSettled: true };
  const { result, rerender } = renderHook(
    ({ authorization }) =>
      useReviewGuard({
        client,
        identity: { ...identity, authorization },
      }),
    { initialProps: { authorization: "scope-A" } },
  );
  const original = result.current.begin();
  rerender({ authorization: "scope-B" });
  rerender({ authorization: "scope-A" });
  expect(original.isStale()).toBe(true);
  expect(result.current.begin().isStale()).toBe(false);
});
