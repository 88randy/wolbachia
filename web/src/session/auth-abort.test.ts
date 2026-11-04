import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AUTH_REQUEST_TIMEOUT_MS } from "../api/auth-timeout";
import { createWebApiClient } from "../api/create-web-api-client";
import { requestLogin } from "../auth/request-login";
import { apiError, createFakeApi } from "../test/fake-api";
import type { FakeApiRoutes, RecordedRequest } from "../test/fake-api";
import { runAuthOperation } from "./auth-operation";
import { requestLogout } from "./request-logout";

const CSRF = "GET /api/v1/auth/csrf/";
const LOGIN = "POST /api/v1/auth/login/";
const LOGOUT = "POST /api/v1/auth/logout/";
const CREDENTIALS = { username: "ana", password: "pw-for-abort-test" };

/** A request that never answers by itself: it only ends when the app aborts it. */
function hangUntilAborted(request: RecordedRequest): Promise<Response> {
  return new Promise((_, reject) => {
    const abort = () => {
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (request.signal.aborted)
      abort(); // a real fetch also rejects at once
    else request.signal.addEventListener("abort", abort);
  });
}

function clientFor(routes: FakeApiRoutes) {
  return createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: createFakeApi(routes).fetch });
}

function setCsrfCookie() {
  document.cookie = "csrftoken=test-csrf; path=/";
}

/** Lets the first request of the operation start before the test acts. */
function tick() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

beforeEach(() => {
  document.cookie = "csrftoken=; Max-Age=0; path=/";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

async function nextOperationRuns(): Promise<void> {
  const next = runAuthOperation("login", () => Promise.resolve("ran"));
  await expect(next.result).resolves.toBe("ran");
}

describe("abandoning a login aborts every request it waits for", () => {
  test("during the CSRF bootstrap request", async () => {
    const client = clientFor({ [CSRF]: hangUntilAborted });
    const login = runAuthOperation("login", ({ signal }) =>
      requestLogin(client, CREDENTIALS, signal),
    );
    await tick();

    login.abandon();

    await login.result;
    await nextOperationRuns();
  });

  test("during the CSRF refresh after a 403", async () => {
    setCsrfCookie();
    const client = clientFor({
      [LOGIN]: apiError(403, "permission_denied"),
      [CSRF]: hangUntilAborted,
    });
    const login = runAuthOperation("login", ({ signal }) =>
      requestLogin(client, CREDENTIALS, signal),
    );
    await tick();

    login.abandon();

    await login.result;
    await nextOperationRuns();
  });

  test("during the login request itself", async () => {
    setCsrfCookie();
    const client = clientFor({ [LOGIN]: hangUntilAborted });
    const login = runAuthOperation("login", ({ signal }) =>
      requestLogin(client, CREDENTIALS, signal),
    );
    await tick();

    login.abandon();

    await login.result;
    await nextOperationRuns();
  });
});

describe("a hung auth request is released by its timeout", () => {
  /** The real timeout is 15 s: its signal is replaced by one the test fires. */
  function stubTimeout() {
    const timeout = new AbortController();
    const spy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    return {
      fire: () => {
        timeout.abort();
      },
      spy,
    };
  }

  test("a sign-out waiting for the CSRF cookie", async () => {
    const { fire, spy } = stubTimeout();
    const client = clientFor({ [CSRF]: hangUntilAborted });
    const logout = runAuthOperation("logout", ({ signal }) => requestLogout(client, signal));
    const queued = runAuthOperation("login", () => Promise.resolve("ran"));
    await tick();

    fire();

    await expect(logout.result).resolves.toMatchObject({ ok: false });
    await expect(queued.result).resolves.toBe("ran");
    expect(spy).toHaveBeenCalledWith(AUTH_REQUEST_TIMEOUT_MS);
  });

  test("a login request that never answers", async () => {
    setCsrfCookie();
    const { fire } = stubTimeout();
    const client = clientFor({ [LOGIN]: hangUntilAborted });
    const login = runAuthOperation("login", ({ signal }) =>
      requestLogin(client, CREDENTIALS, signal),
    );
    await tick();

    fire();

    await expect(login.result).resolves.toMatchObject({ ok: false });
  });

  test("a sign-out request that never answers keeps working after the 403 refresh timeout", async () => {
    setCsrfCookie();
    const { fire } = stubTimeout();
    const client = clientFor({
      [LOGOUT]: apiError(403, "permission_denied"),
      [CSRF]: hangUntilAborted,
    });
    const logout = runAuthOperation("logout", ({ signal }) => requestLogout(client, signal));
    await tick();

    fire();

    await expect(logout.result).resolves.toMatchObject({ ok: false });
  });
});
