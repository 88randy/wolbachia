import { ApiError } from "@wolbachia/api-client";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createFakeApi, makeMe, makeOrganization, noContent } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { fakePassword } from "../test/fake-credentials";
import { renderApp } from "../test/render-app";
import type { Me } from "./me";
import { clearOrganizationSlug } from "./organization-slug";
import { endSessionExpiry } from "./session-events";

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

function deferred() {
  let release: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { promise, release };
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

describe("re-authentication and sign-out never overlap", () => {
  test("sign-out is disabled while the login is pending, and the late login still lands", async () => {
    const login = deferred();
    const { api } = await openExpired({ [LOGIN]: () => login.promise });
    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    expect(logoutRequests(api)).toEqual([]);
    login.release(Response.json({ me: makeMe(), server_time: "2026-11-04T12:00:00Z" }));

    await vi.waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(logoutRequests(api)).toEqual([]);
  });

  test("the login is ignored while the sign-out is pending: nothing repopulates /me/", async () => {
    const logout = deferred();
    const { api, app } = await openExpired({ [LOGOUT]: () => logout.promise });
    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);
    // While the sign-out runs the button already reads "Entrando…" (busy).
    await userEvent.click(screen.getByRole("button", { name: "Entrando…" }));
    expect(api.requests.some((request) => request.path === "/api/v1/auth/login/")).toBe(false);
    logout.release(noContent(204));

    expect(await screen.findByRole("heading", { level: 1, name: "Inicia sesión" })).toBeDefined();
    expect(app.queryClient.getQueryData(["me"])).toBeUndefined();
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
