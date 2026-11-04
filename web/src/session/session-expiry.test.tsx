import { ApiError } from "@wolbachia/api-client";
import { MutationObserver } from "@tanstack/react-query";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiError, createFakeApi, makeMe, noContent } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { fakePassword } from "../test/fake-credentials";
import { renderApp } from "../test/render-app";
import {
  clearOrganizationSlug,
  getOrganizationSlug,
  setOrganizationSlug,
} from "./organization-slug";
import { endSessionExpiry, isSessionExpired } from "./session-events";

const ME = "GET /api/v1/me/";
const LOGIN = "POST /api/v1/auth/login/";
const LOGOUT = "POST /api/v1/auth/logout/";
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

async function openShell(routes: FakeApiRoutes = {}) {
  const api = createFakeApi({
    [ME]: Response.json(makeMe()),
    [LOGIN]: Response.json({ me: makeMe(), server_time: "2026-11-04T12:00:00Z" }),
    [LOGOUT]: noContent(204),
    ...routes,
  });
  const app = await renderApp({ fetch: api.fetch });
  await screen.findByRole("heading", { level: 1, name: "Inicio" });
  return { api, app };
}

type App = Awaited<ReturnType<typeof openShell>>["app"];

/** A request of some screen fails with this answer; the caches report it to the session. */
async function failQuery(app: App, error: ApiError) {
  await act(async () => {
    await app.queryClient
      .query({ queryKey: ["probe", Math.random()], queryFn: () => Promise.reject(error) })
      .catch(() => undefined);
  });
}

async function failMutation(app: App, error: ApiError) {
  await act(async () => {
    await new MutationObserver(app.queryClient, { mutationFn: () => Promise.reject(error) })
      .mutate()
      .catch(() => undefined);
  });
}

describe("session expiry: re-authentication over the current page", () => {
  test("a 401 on a query opens the dialog and the page stays as it was", async () => {
    const { app } = await openShell();
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar" }), "ejemplo");

    await failQuery(app, new ApiError(401));

    const dialog = await screen.findByRole("dialog", { name: "Tu sesión terminó" });
    expect(dialog.textContent).toContain("lo que tenías sin guardar se conserva");
    expect(screen.getByRole("heading", { level: 1, name: "Inicio" })).toBeDefined();
    expect(app.router.state.location.pathname).toBe("/");
  });

  test("a 401 on a mutation keeps the draft: what was typed is still there", async () => {
    const { app } = await openShell();
    const draft = screen.getByRole("searchbox", { name: "Buscar" });
    await userEvent.type(draft, "borrador sin guardar");

    await failMutation(app, new ApiError(401));

    await screen.findByRole("dialog");
    expect(screen.getByRole("searchbox", { hidden: true, name: "Buscar" })).toBe(draft);
    expect((draft as HTMLInputElement).value).toBe("borrador sin guardar");
  });

  test("shows the username read-only and puts focus on the password", async () => {
    const { app } = await openShell();

    await failQuery(app, new ApiError(401));

    const username = await screen.findByLabelText<HTMLInputElement>("Usuario");
    expect(username.value).toBe("ana.supervisora");
    expect(username.readOnly).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText("Contraseña"));
  });

  test("signing in again closes it, sends the stored credentials and refreshes the queries", async () => {
    const { api, app } = await openShell();
    const search = screen.getByRole("searchbox", { name: "Buscar" });
    search.focus();
    await failQuery(app, new ApiError(401));
    await screen.findByRole("dialog");
    const meBefore = api.requests.filter((request) => request.path === "/api/v1/me/").length;

    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    const login = api.requests.find((request) => request.path === "/api/v1/auth/login/");
    expect(login?.body).toEqual({ username: "ana.supervisora", password: PASSWORD });
    expect(login?.headers.get("X-CSRFToken")).toBe("test-csrf");
    expect(isSessionExpired()).toBe(false);
    await vi.waitFor(() => {
      const meAfter = api.requests.filter((request) => request.path === "/api/v1/me/").length;
      expect(meAfter).toBeGreaterThan(meBefore);
    });
    expect(document.activeElement).toBe(search);
  });

  test("a wrong password is explained and the dialog stays", async () => {
    const { app } = await openShell({ [LOGIN]: apiError(401, "invalid_credentials") });
    await failQuery(app, new ApiError(401));
    await screen.findByRole("dialog");

    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("El usuario o la contraseña no coinciden.");
    expect(document.activeElement).toBe(alert);
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  test("an empty password is asked for", async () => {
    const { app } = await openShell();
    await failQuery(app, new ApiError(401));
    await screen.findByRole("dialog");

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Escribe tu contraseña.")).toBeDefined();
  });

  test("Escape does not dismiss it (the way out is signing out)", async () => {
    const { app } = await openShell();
    await failQuery(app, new ApiError(401));
    const dialog = await screen.findByRole("dialog");

    const cancel = new Event("cancel", { cancelable: true });
    dialog.dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(true);
  });

  test("Sign out from the dialog goes to sign-in, and a new session does not start expired", async () => {
    const { app } = await openShell();
    setOrganizationSlug("norte");
    await failQuery(app, new ApiError(401));
    await screen.findByRole("dialog");

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Inicia sesión" })).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(isSessionExpired()).toBe(false);
    expect(getOrganizationSlug()).toBeUndefined();
  });

  test("only a 401 after sign-in counts: other failures leave the page alone", async () => {
    const { app } = await openShell();

    await failQuery(app, new ApiError(500));
    await failQuery(app, new ApiError(403));
    await failQuery(app, new ApiError(404));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(isSessionExpired()).toBe(false);
  });

  test("a 401 with nobody signed in is just 'not signed in', not an expiry", async () => {
    const api = createFakeApi();
    const app = await renderApp({ path: "/login", fetch: api.fetch, me: null });
    await screen.findByRole("heading", { level: 1, name: "Inicia sesión" });

    await act(async () => {
      await app.queryClient
        .query({ queryKey: ["probe"], queryFn: () => Promise.reject(new ApiError(401)) })
        .catch(() => undefined);
    });

    expect(isSessionExpired()).toBe(false);
  });

  test("has no axe violations, in Spanish and English", async () => {
    const { app } = await openShell();
    await failQuery(app, new ApiError(401));
    await screen.findByRole("dialog");

    expect(await axe(app.container)).toHaveNoViolations();
    await userEvent.click(
      screen.getByRole("button", { name: "ES: cambiar idioma a inglés", hidden: true }),
    );
    expect(await screen.findByRole("dialog", { name: "Your session ended" })).toBeDefined();
    expect(await axe(app.container)).toHaveNoViolations();
  });
});

describe("a membership lost in the middle of a session", () => {
  test("with several organizations left, the user is sent to choose one", async () => {
    setOrganizationSlug("norte");
    const organizations = [
      { slug: "norte", name: "Región Norte" },
      { slug: "sur", name: "Región Sur" },
    ];
    let lost = false;
    const { app } = await openShell({
      [ME]: () =>
        Response.json(
          lost
            ? makeMe({ organization: null, profiles: [], permissions: [], organizations })
            : makeMe({ organizations }),
        ),
    });
    lost = true;

    await failQuery(app, new ApiError(403, { code: "no_active_membership", detail: "Gone." }));

    await vi.waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/select-organization");
    });
    expect(getOrganizationSlug()).toBeUndefined();
  });

  test("with no membership at all, the user is sent to sign in with a notice", async () => {
    let lost = false;
    const { app } = await openShell({
      [ME]: () => (lost ? apiError(403, "no_active_membership") : Response.json(makeMe())),
    });
    lost = true;

    await failQuery(app, new ApiError(403, { code: "no_active_membership", detail: "Gone." }));

    await vi.waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/login");
    });
    expect(app.router.state.location.search).toEqual({ notice: "no-membership" });
  });
});
