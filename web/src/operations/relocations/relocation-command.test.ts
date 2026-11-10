import { createApiClient } from "@wolbachia/api-client";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { createFakeApi } from "../../test/fake-api";
import { runRelocationCommand } from "./relocation-command";
import type { CommandContext } from "./relocation-command";
import { PROPOSAL_ID, relocationReceipt } from "./relocation-fixtures";
afterEach(() => {
  vi.restoreAllMocks();
});
test("an in-flight decision is single and cannot publish after its session owner changes", async () => {
  let release: (response: Response) => void = () => undefined;
  const held = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const api = createFakeApi({ [`POST /api/v1/relocations/${PROPOSAL_ID}/approve/`]: () => held });
  const client = createApiClient({
    baseUrl: "https://test.invalid",
    auth: { kind: "session", getCsrfToken: () => undefined },
    fetch: api.fetch,
  });
  let isStale = false;
  const context: CommandContext = {
    scope: {
      client,
      context: "scope-A",
      canRead: true,
      canDecide: true,
      identity: { userId: "reviewer-A", organizationSlug: "org-A", revision: 0, isSettled: true },
    },
    cache: new QueryClient(),
    begin: () => ({ signal: new AbortController().signal, isStale: () => isStale }),
    lock: { current: false },
    failure: null,
    setBusy: vi.fn(),
    setFailure: vi.fn(),
    setReceipt: vi.fn(),
  };
  const command = {
    id: PROPOSAL_ID,
    decision: "approve" as const,
    reason: "Approved original coordinates",
  };
  const attempt = runRelocationCommand(context, command);
  await vi.waitFor(() => {
    expect(api.requests).toHaveLength(1);
  });
  await runRelocationCommand(context, command);
  isStale = true;
  release(Response.json(relocationReceipt("approved"), { status: 201 }));
  await attempt;
  expect(context.setReceipt).not.toHaveBeenCalled();
  expect(context.setFailure).not.toHaveBeenCalled();
  expect(api.requests).toHaveLength(1);
});

test("the imperative command gate refuses an offline write even with a valid reviewed source", async () => {
  const api = createFakeApi();
  const client = createApiClient({
    baseUrl: "https://test.invalid",
    auth: { kind: "session", getCsrfToken: () => undefined },
    fetch: api.fetch,
  });
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  const context: CommandContext = {
    scope: {
      client,
      context: "scope-A",
      canRead: true,
      canDecide: true,
      identity: { userId: "reviewer-A", organizationSlug: "org-A", revision: 0, isSettled: true },
    },
    cache: new QueryClient(),
    begin: () => ({ signal: new AbortController().signal, isStale: () => false }),
    lock: { current: false },
    failure: null,
    setBusy: vi.fn(),
    setFailure: vi.fn(),
    setReceipt: vi.fn(),
  };
  await runRelocationCommand(context, {
    id: PROPOSAL_ID,
    decision: "reject",
    reason: "Reviewed but offline",
  });
  expect(api.requests).toHaveLength(0);
  expect(context.setReceipt).not.toHaveBeenCalled();
});
