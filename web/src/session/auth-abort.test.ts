import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createWebApiClient } from "../api/create-web-api-client";
import { requestLogin } from "../auth/request-login";
import { apiError, createFakeApi } from "../test/fake-api";
import type { FakeApiRoutes, RecordedRequest } from "../test/fake-api";
import { abandonAuthOperation, finishAuthOperation, startAuthOperation } from "./auth-operation";
import type { AuthOperation } from "./auth-operation";
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

beforeEach(() => {
  document.cookie = "csrftoken=; Max-Age=0; path=/";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

/** Runs an operation like the hooks do, abandons it while it waits, and returns the next start. */
async function abandonWhileWaiting(
  kind: AuthOperation,
  run: (signal: AbortSignal) => Promise<unknown>,
) {
  const operation = startAuthOperation(kind);
  if (operation === undefined) throw new Error("the lock was already held");
  const settled = run(operation.signal).finally(() => {
    finishAuthOperation(operation.token);
  });
  abandonAuthOperation(operation.token);
  await settled;
  return startAuthOperation(kind);
}

describe("abandoning an auth operation always releases the lock", () => {
  test("login, during the CSRF bootstrap request", async () => {
    const client = clientFor({ [CSRF]: hangUntilAborted });

    const next = await abandonWhileWaiting("login", (signal) =>
      requestLogin(client, CREDENTIALS, signal),
    );

    expect(next).toBeDefined();
  });

  test("login, during the CSRF refresh after a 403", async () => {
    setCsrfCookie();
    const client = clientFor({
      [LOGIN]: apiError(403, "permission_denied"),
      [CSRF]: hangUntilAborted,
    });

    const operation = startAuthOperation("login");
    const settled = requestLogin(client, CREDENTIALS, operation?.signal).finally(() => {
      finishAuthOperation(operation?.token ?? -1);
    });
    // The login answered 403 and the refresh is now waiting: leave the screen.
    await vi.waitFor(() => {
      expect(operation?.signal.aborted).toBe(false);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    abandonAuthOperation(operation?.token ?? -1);
    await settled;

    expect(startAuthOperation("login")).toBeDefined();
  });

  test("login, during the login request itself", async () => {
    setCsrfCookie();
    const client = clientFor({ [LOGIN]: hangUntilAborted });

    const next = await abandonWhileWaiting("login", (signal) =>
      requestLogin(client, CREDENTIALS, signal),
    );

    expect(next).toBeDefined();
  });

  test("sign-out, during the CSRF bootstrap request", async () => {
    const client = clientFor({ [CSRF]: hangUntilAborted });

    const next = await abandonWhileWaiting("logout", (signal) => requestLogout(client, signal));

    expect(next).toBeDefined();
  });

  test("sign-out, during the CSRF refresh after a 403", async () => {
    setCsrfCookie();
    const client = clientFor({
      [LOGOUT]: apiError(403, "permission_denied"),
      [CSRF]: hangUntilAborted,
    });

    const operation = startAuthOperation("logout");
    const settled = requestLogout(client, operation?.signal).finally(() => {
      finishAuthOperation(operation?.token ?? -1);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    abandonAuthOperation(operation?.token ?? -1);
    await settled;

    expect(startAuthOperation("logout")).toBeDefined();
  });
});
