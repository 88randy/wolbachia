import { ApiError } from "@wolbachia/api-client";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiError, createFakeApi, makeMe, makeOrganization, noContent } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { fakePassword } from "../test/fake-credentials";
import { renderApp } from "../test/render-app";
import type { Me } from "./me";
import { clearOrganizationSlug } from "./organization-slug";
import { endSessionExpiry } from "./session-events";

const ME = "GET /api/v1/me/";
const LOGIN = "POST /api/v1/auth/login/";
const LOGOUT = "POST /api/v1/auth/logout/";
const CSRF = "GET /api/v1/auth/csrf/";
const PASSWORD = fakePassword();

beforeEach(() => {
  endSessionExpiry();
  clearOrganizationSlug();
  window.localStorage.clear();
  document.cookie = "csrftoken=test-csrf; path=/";
});

afterEach(() => {
  endSessionExpiry();
  vi.restoreAllMocks();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

function deferred() {
  let release: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const state = { promise, release, pending: false, hold: () => promise };
  state.hold = () => {
    state.pending = true;
    return promise;
  };
  return state;
}

async function openExpired(routes: FakeApiRoutes = {}, path = "/", me: Me = makeMe()) {
  const api = createFakeApi({
    [ME]: Response.json(me),
    [LOGIN]: Response.json({ me, server_time: "2026-11-04T12:00:00Z" }),
    [LOGOUT]: noContent(204),
    ...routes,
  });
  const app = await renderApp({ path, fetch: api.fetch });
  await screen.findByRole("main");
  await act(async () => {
    await app.queryClient
      .query({ queryKey: ["probe"], queryFn: () => Promise.reject(new ApiError(401)) })
      .catch(() => undefined);
  });
  await screen.findByRole("dialog");
  return { api, app };
}

function logoutRequests(api: { requests: { path: string }[] }) {
  return api.requests.filter((request) => request.path === "/api/v1/auth/logout/");
}

describe("re-authentication and sign-out are queued, not rejected", () => {
  test("a sign-out clicked while the login is pending runs after it and wins", async () => {
    const login = deferred();
    const { api, app } = await openExpired({ [LOGIN]: () => login.promise });
    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(logoutRequests(api)).toEqual([]);
    login.release(Response.json({ me: makeMe(), server_time: "2026-11-04T12:00:00Z" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Inicia sesión" })).toBeDefined();
    expect(logoutRequests(api)).toHaveLength(1);
    expect(app.queryClient.getQueryData(["me"])).toBeUndefined();
  });

  test("a login submitted while the sign-out is pending is not sent: the dialog is gone", async () => {
    const logout = deferred();
    const { api, app } = await openExpired({ [LOGOUT]: () => logout.promise });
    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(api.requests.some((request) => request.path === "/api/v1/auth/login/")).toBe(false);
    logout.release(noContent(204));

    expect(await screen.findByRole("heading", { level: 1, name: "Inicia sesión" })).toBeDefined();
    expect(app.queryClient.getQueryData(["me"])).toBeUndefined();
    expect(api.requests.some((request) => request.path === "/api/v1/auth/login/")).toBe(false);
  });

  test("a failed sign-out is reported inside the dialog", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await openExpired({
      [LOGOUT]: () => {
        throw new TypeError("Failed to fetch");
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("No hay conexión con el servidor");
    expect(screen.getByRole("dialog")).toBeDefined();
  });
});

describe("leaving the page during a pending sign-out", () => {
  const SESSION = { me: makeMe(), server_time: "2026-11-04T12:00:00Z" };

  /** Sign-out waits on `held`; the user goes to /login and signs in again meanwhile. */
  async function signOutThenSignInAgain(routes: FakeApiRoutes, held: ReturnType<typeof deferred>) {
    const api = createFakeApi({
      [ME]: Response.json(makeMe()),
      [LOGIN]: Response.json(SESSION),
      ...routes,
    });
    const app = await renderApp({ fetch: api.fetch });
    await screen.findByRole("heading", { level: 1, name: "Inicio" });
    await userEvent.click(screen.getByRole("button", { name: /Menú de usuario/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await vi.waitFor(() => {
      expect(held.pending).toBe(true);
    });
    app.router.history.push("/login");
    await screen.findByRole("heading", { level: 1, name: "Inicia sesión" });
    await userEvent.type(screen.getByLabelText("Usuario"), "ana.supervisora");
    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    return api;
  }

  function order(api: { requests: { method: string; path: string }[] }) {
    return api.requests
      .filter((request) => request.method === "POST")
      .map((request) => request.path.replace("/api/v1/auth/", ""));
  }

  test("during the CSRF bootstrap: the login is sent after the logout settles", async () => {
    document.cookie = "csrftoken=; Max-Age=0; path=/";
    const held = deferred();
    let csrfCalls = 0;
    const api = await signOutThenSignInAgain(
      {
        [CSRF]: () => {
          csrfCalls += 1;
          document.cookie = "csrftoken=test-csrf; path=/";
          return csrfCalls === 1 ? held.hold() : noContent(204);
        },
        [LOGOUT]: noContent(204),
      },
      held,
    );
    expect(order(api)).toEqual([]);

    held.release(noContent(204));

    await screen.findByRole("heading", { level: 1, name: "Inicio" });
    expect(order(api)).toEqual(["logout/", "login/"]);
  });

  test("during the CSRF refresh after a 403: the login is sent after the logout settles", async () => {
    const held = deferred();
    let logouts = 0;
    let csrfCalls = 0;
    const api = await signOutThenSignInAgain(
      {
        [CSRF]: () => {
          csrfCalls += 1;
          return csrfCalls === 1 ? held.hold() : noContent(204);
        },
        [LOGOUT]: () => {
          logouts += 1;
          return logouts === 1 ? apiError(403, "permission_denied") : noContent(204);
        },
      },
      held,
    );
    expect(order(api)).toEqual(["logout/"]);

    held.release(noContent(204));

    await screen.findByRole("heading", { level: 1, name: "Inicio" });
    expect(order(api)).toEqual(["logout/", "logout/", "login/"]);
  });
});

describe("leaving a pending re-authentication", () => {
  test("Back to /login, a new sign-in, then sign-out still sends its request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let logins = 0;
    const { api, app } = await openExpired({
      [LOGIN]: (request) => {
        logins += 1;
        if (logins > 1) return Response.json({ me: makeMe(), server_time: "2026-11-04T12:00:00Z" });
        return new Promise<Response>((_, reject) => {
          request.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      },
    });
    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    app.router.history.push("/login");
    await screen.findByRole("heading", { level: 1, name: "Inicia sesión" });
    await userEvent.type(screen.getByLabelText("Usuario"), "ana.supervisora");
    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("heading", { level: 1, name: "Inicio" });
    await userEvent.click(screen.getByRole("button", { name: /Menú de usuario/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await vi.waitFor(() => {
      expect(logoutRequests(api)).toHaveLength(1);
    });
  });
});

describe("re-authentication landing somewhere else", () => {
  test("another organization drops the old cache and runs the guards again", async () => {
    const before = makeMe({ permissions: ["catalog.read"] });
    const after = {
      ...makeMe({ permissions: [] }),
      organization: makeOrganization("sur", "Región Sur"),
    };
    let current: Me = before;
    const { app } = await openExpired(
      {
        [ME]: () => Response.json(current),
        [LOGIN]: () => {
          current = after;
          return Response.json({ me: after, server_time: "2026-11-04T12:00:00Z" });
        },
      },
      "/settings",
      before,
    );
    app.queryClient.setQueryData(["incidents", "list"], [{ id: "x" }]);

    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "No tienes acceso a esta sección" }),
    ).toBeDefined();
    expect(app.queryClient.getQueryData(["incidents", "list"])).toBeUndefined();
  });
});

describe("the dialog cannot be closed from the keyboard", () => {
  test("a close event while the session is expired opens it again", async () => {
    await openExpired();
    const dialog = screen.getByRole<HTMLDialogElement>("dialog");

    dialog.close();

    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText("Contraseña"));
  });
});
