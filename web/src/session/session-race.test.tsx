import { ApiError } from "@wolbachia/api-client";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiError, createFakeApi, makeMe, makeOrganization, noContent } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { fakePassword } from "../test/fake-credentials";
import { renderApp } from "../test/render-app";
import { createWebApiClient } from "../api/create-web-api-client";
import type { Me } from "./me";
import { reconcileSession } from "./session-reconcile";
import { clearOrganizationSlug } from "./organization-slug";
import { endSessionExpiry } from "./session-events";
import {
  isSessionKnown,
  setSessionState,
  sessionState,
  subscribeToRevision,
} from "./session-revision";

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

/** What another tab does when it signs in: it announces the change on the shared channel. */
function announce(): void {
  const otherTab = new BroadcastChannel("wolbachia.session");
  otherTab.postMessage("changed");
  otherTab.close();
}

function hop(): Promise<void> {
  return new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      resolve();
    };
    channel.port2.postMessage(0);
  });
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
    await vi.waitFor(() => {
      expect(app.queryClient.getQueryData(["me"])).toBeUndefined();
    });
    expect(api.requests.some((request) => request.path === "/api/v1/auth/login/")).toBe(false);
  });

  test("a failed sign-out is reported inside the dialog", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { api } = await openExpired({
      [LOGOUT]: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    api.setRoute(ME, apiError(401, "not_authenticated")); // the session really is gone

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
    const submit = screen.getByRole("button", { name: "Entrar" });
    await userEvent.click(submit);
    // A click can finish before async validation submits: keep logout held until login is pending.
    await waitFor(() => {
      expect(submit.getAttribute("aria-disabled")).toBe("true");
    });
    return { api, app };
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
    const { api, app } = await signOutThenSignInAgain(
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
    // The sign-in accepted after the sign-out changed the revision: its /me/ was not wiped.
    expect(app.queryClient.getQueryData(["me"])).toBeDefined();
  });

  test("during the CSRF refresh after a 403: the login is sent after the logout settles", async () => {
    const held = deferred();
    let logouts = 0;
    let csrfCalls = 0;
    const { api, app } = await signOutThenSignInAgain(
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
    expect(app.queryClient.getQueryData(["me"])).toBeDefined();
  });
});

describe("a /me/ of the closed session cannot survive the sign-out", () => {
  /** /me/ starts before the logout and answers after it. */
  async function signOutWithLateMe() {
    let meCalls = 0;
    const late = deferred();
    const api = createFakeApi({
      [ME]: () => {
        meCalls += 1;
        if (meCalls === 2) return late.promise;
        return meCalls === 1 ? Response.json(makeMe()) : apiError(401, "not_authenticated");
      },
      [LOGOUT]: noContent(204),
    });
    const app = await renderApp({ fetch: api.fetch });
    await screen.findByRole("heading", { level: 1, name: "Inicio" });
    const refetch = app.queryClient.refetchQueries({ queryKey: ["me"] });
    await vi.waitFor(() => {
      expect(meCalls).toBe(2);
    });

    await userEvent.click(screen.getByRole("button", { name: /Menú de usuario/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await screen.findByRole("heading", { level: 1, name: "Inicia sesión" });
    late.release(Response.json(makeMe()));
    await refetch;

    return { app, calls: () => meCalls };
  }

  test("the cache is cleared", async () => {
    const { app } = await signOutWithLateMe();

    expect(app.queryClient.getQueryData(["me"])).toBeUndefined();
  });

  test("the next guard check asks the server", async () => {
    const { app, calls } = await signOutWithLateMe();

    app.router.history.push("/settings");

    await vi.waitFor(() => {
      expect(calls()).toBe(3);
    });
  });
});

describe("a hung /me/ after signing in again cannot block a sign-out", () => {
  test("re-authentication returning no organization, /me/ never answering: the logout is sent", async () => {
    const chooser = makeMe({
      organization: null,
      profiles: [],
      permissions: [],
      organizations: [
        { slug: "norte", name: "Región Norte" },
        { slug: "sur", name: "Región Sur" },
      ],
    });
    let meCalls = 0;
    const { api } = await openExpired({
      [ME]: () => {
        meCalls += 1;
        // The first answer is the page's own; every refetch after it hangs forever.
        return meCalls === 1 ? Response.json(makeMe()) : new Promise<Response>(() => undefined);
      },
      [LOGIN]: Response.json({ me: chooser, server_time: "2026-11-04T12:00:00Z" }),
    });
    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    await userEvent.click(screen.getByRole("button", { name: /Menú de usuario/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await vi.waitFor(() => {
      expect(logoutRequests(api)).toHaveLength(1);
    });
  });
});

describe("leaving a pending re-authentication", () => {
  test("Back to /login, a new sign-in, then sign-out still sends its request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let logins = 0;
    let abandoned: AbortSignal | undefined;
    const { api, app } = await openExpired({
      [LOGIN]: (request) => {
        logins += 1;
        if (logins > 1) return Response.json({ me: makeMe(), server_time: "2026-11-04T12:00:00Z" });
        abandoned = request.signal;
        return new Promise<Response>((_, reject) => {
          request.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      },
    });
    // Keystroke behavior has its own form tests; this test owns request ordering and abandonment.
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: PASSWORD } });
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => {
      expect(logins).toBe(1);
    });

    app.router.history.push("/login");
    await waitFor(() => {
      expect(abandoned?.aborted).toBe(true);
    });
    await screen.findByRole("heading", { level: 1, name: "Inicia sesión" });
    fireEvent.change(screen.getByLabelText("Usuario"), { target: { value: "ana.supervisora" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: PASSWORD } });
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("heading", { level: 1, name: "Inicio" });
    await userEvent.click(screen.getByRole("button", { name: /Menú de usuario/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await vi.waitFor(() => {
      expect(logoutRequests(api)).toHaveLength(1);
    });
    const loginRequests = api.requests.filter((request) => request.path === "/api/v1/auth/login/");
    expect(loginRequests).toHaveLength(2);
    for (const request of loginRequests)
      expect(request.body).toEqual({ username: "ana.supervisora", password: PASSWORD });
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

describe("the cookie is the truth (#82)", () => {
  test("/me/ is accepted only for the revision that asked for it: a superseded reconcile never stores B and the state ends unknown", async () => {
    const login = deferred();
    const meOfB = deferred();
    const userA = makeMe();
    const userB = {
      ...makeMe({ user: { ...userA.user, id: "7a7a7a7a-0000-4000-8000-000000000003" } }),
      organization: null,
    };
    let meCalls = 0;
    const { api, app } = await openExpired({ [LOGIN]: () => login.promise });
    const seen: string[] = [];
    app.queryClient.getQueryCache().subscribe(() => {
      const id = app.queryClient.getQueryData<Me>(["me"])?.user.id;
      if (id !== undefined) seen.push(id);
    });
    api.setRoute(ME, () => {
      meCalls += 1;
      return meCalls === 1 ? meOfB.promise : Promise.resolve(apiError(503, "server_error"));
    });
    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    announce(); // another tab signed in as B: this tab's reconcile asks /me/ (pending)
    await waitFor(() => {
      expect(meCalls).toBe(1);
    });

    // A's login completes: it supersedes B's reconcile, whose /me/ then fails to be A's follow-up.
    login.release(Response.json({ me: userA, server_time: "2026-11-04T12:00:00Z" }));
    await waitFor(() => {
      expect(meCalls).toBe(2);
    });
    meOfB.release(Response.json(userB));
    await hop();
    await waitFor(() => {
      expect(sessionState()).toBe("unknown");
    });

    expect(seen).not.toContain(userB.user.id);
    expect(app.queryClient.getQueryData<Me>(["me"])?.user.id).toBe(userA.user.id);
    expect(app.router.state.location.pathname).not.toBe("/select-organization");
  });

  test("a 401 during a verify with /me/ pending ends unknown and is never known without an accepted /me/ (#82)", async () => {
    const meLater = deferred();
    const api = createFakeApi({ [ME]: Response.json(makeMe()) });
    const app = await renderApp({ path: "/", fetch: api.fetch });
    await screen.findByRole("main");
    api.setRoute(ME, () => meLater.promise);
    const states: string[] = [];
    const stop = subscribeToRevision(() => states.push(sessionState()));

    window.dispatchEvent(new Event("focus")); // verify: /me/ is pending
    await waitFor(() => {
      expect(sessionState()).toBe("reconciling");
    });
    await app.queryClient
      .query({ queryKey: ["probe"], queryFn: () => Promise.reject(new ApiError(401)) })
      .catch(() => undefined);
    meLater.release(Response.json(makeMe())); // the cancelled /me/ is reverted to the old value
    await hop();

    await waitFor(() => {
      expect(sessionState()).toBe("unknown");
    });
    expect(states).not.toContain("known");
    stop();
  });

  test("B signs in from another tab while A's initial /me/ is pending: A is never stored or shown (#82)", async () => {
    const meOfA = deferred();
    const userA = makeMe({ user: { ...makeMe().user, first_name: "Ana", last_name: "UsuariaA" } });
    const userB = makeMe({
      user: {
        ...makeMe().user,
        id: "b0b0b0b0-0000-4000-8000-000000000009",
        first_name: "Beto",
        last_name: "UsuarioB",
      },
    });
    let calls = 0;
    const api = createFakeApi({
      [ME]: () => {
        calls += 1;
        return calls === 1 ? meOfA.promise : Promise.resolve(Response.json(userB));
      },
    });
    const starting = renderApp({ path: "/", fetch: api.fetch });
    await waitFor(() => {
      expect(calls).toBe(1);
    });

    announce(); // the listener is installed at the root, before any guard runs
    meOfA.release(Response.json(userA)); // A's answer arrives after the change
    const app = await starting;
    await screen.findByRole("main");

    await waitFor(() => {
      expect(app.queryClient.getQueryData<Me>(["me"])?.user.id).toBe(userB.user.id);
    });
    expect(screen.queryByText(/UsuariaA/)).toBeNull();
  });

  test("a late login body is not published with a stale token: B, not A, ends known (#82)", async () => {
    const login = deferred();
    const userA = makeMe();
    const userB = makeMe({ user: { ...userA.user, id: "b0b0b0b0-0000-4000-8000-000000000007" } });
    const api = createFakeApi({
      [CSRF]: noContent(204),
      [LOGIN]: () => login.promise,
      [ME]: () => Response.json(userB), // the cookie, after the other tab, is B's
    });
    const app = await renderApp({ path: "/login", fetch: api.fetch });
    const seen: string[] = [];
    app.queryClient.getQueryCache().subscribe(() => {
      const id = app.queryClient.getQueryData<Me>(["me"])?.user.id;
      if (id !== undefined) seen.push(id);
    });
    await userEvent.type(await screen.findByLabelText("Usuario"), "ana.supervisora");
    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => {
      expect(api.requests.some((request) => request.path === "/api/v1/auth/login/")).toBe(true);
    });

    announce(); // another tab moved the session to B while A's login is in flight
    await waitFor(() => {
      expect(app.queryClient.getQueryData<Me>(["me"])?.user.id).toBe(userB.user.id);
    });
    login.release(Response.json({ me: userA, server_time: "2026-11-04T12:00:00Z" }));
    await hop();
    await hop();

    expect(seen).not.toContain(userA.user.id);
    expect(app.queryClient.getQueryData<Me>(["me"])?.user.id).toBe(userB.user.id);
    expect(sessionState()).toBe("known");
  });

  test("a login abandoned after its headers arrived reconciles with /me/: A's data never returns under B's cookie (#82)", async () => {
    const userA = makeMe();
    const userB = makeMe({ user: { ...userA.user, id: "b0b0b0b0-0000-4000-8000-000000000007" } });
    const api = createFakeApi({
      [ME]: Response.json(userA),
      [CSRF]: noContent(204),
      // The server already set B's cookie; the body is still pending and dies with the abort.
      [LOGIN]: (request) =>
        new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    });
    const app = await renderApp({ path: "/", fetch: api.fetch });
    await screen.findByRole("main");
    const orgKey = ["org", userA.user.id, userA.organization?.slug, "rows"];
    app.queryClient.setQueryData(orgKey, ["A's row"]);
    await app.router.navigate({ to: "/login" });
    await userEvent.type(await screen.findByLabelText("Usuario"), "ana.supervisora");
    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => {
      expect(api.requests.some((request) => request.path === "/api/v1/auth/login/")).toBe(true);
    });
    expect(app.queryClient.getQueryData(orgKey)).toBeUndefined(); // left `known` BEFORE sending
    api.setRoute(ME, Response.json(userB)); // the cookie is B's now

    await app.router.navigate({ to: "/" }); // Forward: the form unmounts and aborts the read

    await waitFor(() => {
      expect(app.queryClient.getQueryData<Me>(["me"])?.user.id).toBe(userB.user.id);
    });
    expect(app.queryClient.getQueryData(orgKey)).toBeUndefined();
    expect(sessionState()).toBe("known");
    expect(api.requests.filter((request) => request.path === "/api/v1/me/").length).toBeGreaterThan(
      1,
    );
  });

  test("a verify that confirms B between a login's cookie and its late body: B stays, A is never stored (#82)", async () => {
    const login = deferred();
    const userA = makeMe();
    const userB = makeMe({ user: { ...userA.user, id: "b0b0b0b0-0000-4000-8000-000000000007" } });
    const api = createFakeApi({
      [CSRF]: noContent(204),
      [LOGIN]: () => login.promise, // A's cookie was applied; the body is still pending
      [ME]: () => Response.json(userB), // another tab moved the cookie to B
    });
    const app = await renderApp({ path: "/login", fetch: api.fetch });
    const seen: string[] = [];
    app.queryClient.getQueryCache().subscribe(() => {
      const id = app.queryClient.getQueryData<Me>(["me"])?.user.id;
      if (id !== undefined) seen.push(id);
    });
    await userEvent.type(await screen.findByLabelText("Usuario"), "ana.supervisora");
    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => {
      expect(api.requests.some((request) => request.path === "/api/v1/auth/login/")).toBe(true);
    });

    await reconcileSession(
      app.queryClient,
      createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch }),
      "verify",
    );
    expect(app.queryClient.getQueryData<Me>(["me"])?.user.id).toBe(userB.user.id);
    login.release(Response.json({ me: userA, server_time: "2026-11-04T12:00:00Z" }));
    await hop();
    await hop();

    expect(seen).not.toContain(userA.user.id);
    expect(app.queryClient.getQueryData<Me>(["me"])?.user.id).toBe(userB.user.id);
    expect(sessionState()).toBe("known");
  });

  test("a re-authentication from the unknown state makes the identity known again", async () => {
    const { app } = await openExpired();
    setSessionState("unknown"); // the expiry dialog is the way out, so the blocker stays hidden
    expect(isSessionKnown()).toBe(false);
    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => {
      expect(isSessionKnown()).toBe(true);
    });
    expect(screen.queryByText("No pudimos verificar tu sesión")).toBeNull();
    expect(app.queryClient.getQueryData<Me>(["me"])).toBeDefined();
  });

  test("a login the server accepted is not published with a stale token: it reconciles with /me/ and ends with the cookie's identity", async () => {
    const login = deferred();
    const userA = makeMe();
    const userB = makeMe({ user: { ...userA.user, id: "7a7a7a7a-0000-4000-8000-000000000002" } });
    const { api, app } = await openExpired({ [LOGIN]: () => login.promise });
    const otherTab = new BroadcastChannel("wolbachia.session");
    let announcements = 0;
    otherTab.onmessage = () => {
      announcements += 1;
    };
    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    // Another tab signed in as B: this tab reconciles and its /me/ answers B while A's login is
    // still in flight.
    api.setRoute(ME, Response.json(userB));
    otherTab.postMessage("changed");
    await waitFor(() => {
      expect(app.queryClient.getQueryData<Me>(["me"])?.user.id).toBe(userB.user.id);
    });

    // The server accepted A's login last, so the cookie is A's.
    api.setRoute(ME, Response.json(userA));
    login.release(Response.json({ me: userA, server_time: "2026-11-04T12:00:00Z" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(app.queryClient.getQueryData<Me>(["me"])?.user.id).toBe(userA.user.id);
    // The server-confirmed login was announced exactly once (the reconcile does not echo it).
    await new Promise<void>((resolve) => {
      const hop = new MessageChannel();
      hop.port1.onmessage = () => {
        resolve();
      };
      hop.port2.postMessage(0);
    });
    expect(announcements).toBe(1);
    otherTab.close();
  });
});
