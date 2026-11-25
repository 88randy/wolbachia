import { isRedirect } from "@tanstack/react-router";
import { expect, test, vi } from "vitest";
import { createWebApiClient } from "../api/create-web-api-client";
import { createAppQueryClient } from "../api/query-client";
import { reconcileSession } from "../session/session-reconcile";
import { apiError, createFakeApi, makeMe } from "../test/fake-api";
import { requireSession } from "./guards";

test("a session that expired while the tab was away ends on sign-in, even if a focus check cancels the guard's /me/", async () => {
  let release: (response: Response) => void = () => undefined;
  const held = new Promise<Response>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const api = createFakeApi({
    "GET /api/v1/me/": () => (++calls === 1 ? held : apiError(401, "not_authenticated")),
  });
  const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });
  const queryClient = createAppQueryClient({ retry: false });
  const href = "/operations/reviews?item=42";

  const guard = requireSession({ context: { client, queryClient }, location: { href } }).catch(
    (error: unknown) => error,
  );
  await vi.waitFor(() => {
    expect(api.requests).toHaveLength(1);
  });
  const verifying = reconcileSession(queryClient, client, "verify"); // the tab became visible
  release(apiError(401, "not_authenticated"));

  const outcome = await guard;
  expect(await verifying).toBe(false);
  expect(isRedirect(outcome)).toBe(true);
  expect(isRedirect(outcome) && outcome.options).toMatchObject({
    to: "/login",
    search: { redirect: href },
  });
});

test("with a valid session, a focus check that cancels the guard's /me/ still opens the route", async () => {
  let release: (response: Response) => void = () => undefined;
  const held = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const me = makeMe();
  let calls = 0;
  const api = createFakeApi({
    "GET /api/v1/me/": () => (++calls === 1 ? held : Response.json(me)),
  });
  const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });
  const queryClient = createAppQueryClient({ retry: false });

  const guard = requireSession({
    context: { client, queryClient },
    location: { href: "/operations/live" },
  });
  await vi.waitFor(() => {
    expect(api.requests).toHaveLength(1);
  });
  const verifying = reconcileSession(queryClient, client, "verify");
  release(Response.json(me));

  expect(await guard).toEqual(me);
  expect(await verifying).toBe(true);
});
