import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  clearOrganizationSlug,
  getOrganizationSlug,
  setOrganizationSlug,
} from "../session/organization-slug";
import { apiError, createFakeApi, makeMe, noContent } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { runAuthOperation } from "../session/auth-operation";
import { renderApp } from "../test/render-app";
import type { Me } from "../session/me";

const ME = "GET /api/v1/me/";
const LOGOUT = "POST /api/v1/auth/logout/";
const TWO_ORGANIZATIONS = [
  { slug: "norte", name: "Región Norte" },
  { slug: "sur", name: "Región Sur" },
];

beforeEach(() => {
  clearOrganizationSlug();
  window.localStorage.clear();
  document.cookie = "csrftoken=test-csrf; path=/";
});

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

async function openShell(me: Me = makeMe(), routes: FakeApiRoutes = {}, language?: "en") {
  const api = createFakeApi({ [ME]: Response.json(me), [LOGOUT]: noContent(204), ...routes });
  const app = await renderApp({ fetch: api.fetch, ...(language ? { language } : {}) });
  return { api, app };
}

function menuButton() {
  return screen.getByRole("button", { name: /Menú de usuario|User menu/ });
}

describe("user menu", () => {
  test("is a closed disclosure whose name contains the visible name", async () => {
    await openShell();

    const button = screen.getByRole("button", { name: "Ana Pérez Menú de usuario" });

    expect(button.textContent).toContain("Ana Pérez");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe("user-menu-panel");
    expect(screen.queryByText("Cerrar sesión")).toBeNull();
  });

  test("opens with name, profiles in the UI language and organization", async () => {
    await openShell(
      makeMe({
        profiles: [
          { slug: "supervisor", label_es: "Supervisora", label_en: "Supervisor" },
          { slug: "entomologist", label_es: "Entomóloga", label_en: "" },
        ],
      }),
    );

    await userEvent.click(menuButton());

    const panel = document.getElementById("user-menu-panel") as HTMLElement;
    expect(menuButton().getAttribute("aria-expanded")).toBe("true");
    expect(within(panel).getByText("Ana Pérez")).toBeDefined();
    expect(within(panel).getByText("Supervisora, Entomóloga")).toBeDefined();
    expect(within(panel).getByText("Región Norte")).toBeDefined();
  });

  test("shows profile labels in English, falling back to Spanish when blank", async () => {
    await openShell(
      makeMe({
        profiles: [
          { slug: "supervisor", label_es: "Supervisora", label_en: "Supervisor" },
          { slug: "entomologist", label_es: "Entomóloga", label_en: " " },
        ],
      }),
      {},
      "en",
    );

    await userEvent.click(menuButton());

    expect(screen.getByText("Supervisor, Entomóloga")).toBeDefined();
  });

  test("uses the username when the account has no name, and says when there is no profile", async () => {
    const me = makeMe({ profiles: [] });
    await openShell({ ...me, user: { ...me.user, first_name: "", last_name: "" } });

    expect(screen.getByRole("button", { name: "ana.supervisora Menú de usuario" })).toBeDefined();
    await userEvent.click(menuButton());
    expect(screen.getByText("Sin perfil asignado")).toBeDefined();
  });

  test("Escape closes it and returns focus to the button", async () => {
    await openShell();
    await userEvent.click(menuButton());
    screen.getByRole("button", { name: "Cerrar sesión" }).focus();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
    expect(document.activeElement).toBe(menuButton());
    expect(menuButton().getAttribute("aria-expanded")).toBe("false");
  });

  test("a press outside closes it", async () => {
    await openShell();
    await userEvent.click(menuButton());

    await userEvent.click(screen.getByRole("main"));

    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  });

  test("moving focus out of it closes it", async () => {
    await openShell();
    await userEvent.click(menuButton());
    screen.getByRole("button", { name: "Cerrar sesión" }).focus();

    screen.getByRole("searchbox", { name: "Buscar" }).focus();

    await vi.waitFor(() => {
      expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
    });
  });

  test("opens and closes by keyboard", async () => {
    await openShell();
    menuButton().focus();

    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeDefined();
    await userEvent.keyboard("{Enter}");

    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  });

  test("offers Change organization only to users with several organizations", async () => {
    await openShell();
    await userEvent.click(menuButton());
    expect(screen.queryByRole("link", { name: "Cambiar de organización" })).toBeNull();
  });

  test("Change organization goes to the chooser", async () => {
    const { app } = await openShell(makeMe({ organizations: TWO_ORGANIZATIONS }));
    await userEvent.click(menuButton());

    await userEvent.click(screen.getByRole("link", { name: "Cambiar de organización" }));

    await vi.waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/select-organization");
    });
  });

  test("has no axe violations open, in both languages", async () => {
    const { app } = await openShell(makeMe({ organizations: TWO_ORGANIZATIONS }));
    await userEvent.click(menuButton());

    expect(await axe(app.container)).toHaveNoViolations();
  });
});

describe("sign out", () => {
  test("ends the session, forgets the organization and the cache, and goes to sign-in", async () => {
    setOrganizationSlug("norte");
    const { api, app } = await openShell();
    await userEvent.click(menuButton());

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Inicia sesión" })).toBeDefined();
    const logout = api.requests.find((request) => request.method === "POST");
    expect(logout?.path).toBe("/api/v1/auth/logout/");
    expect(logout?.headers.get("X-CSRFToken")).toBe("test-csrf");
    expect(app.router.state.location.pathname).toBe("/login");
  });

  test("sign-out forgets the organization everywhere", async () => {
    setOrganizationSlug("norte");
    await openShell();
    await userEvent.click(menuButton());

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await screen.findByRole("heading", { level: 1, name: "Inicia sesión" });
    expect(getOrganizationSlug()).toBeUndefined();
    expect(window.localStorage.getItem("wolbachia.organization")).toBeNull();
  });

  test("sign-out empties the cache and frees the lock even if the navigation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { app } = await openShell();
    app.queryClient.setQueryData(["incidents"], [{ id: "x" }]);
    vi.spyOn(app.router, "navigate").mockRejectedValue(new Error("navigation failed"));
    await userEvent.click(menuButton());

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    // The shell is still mounted, so its own observer may refetch /me/: use another query.
    await vi.waitFor(() => {
      expect(app.queryClient.getQueryData(["incidents"])).toBeUndefined();
    });
    await expect(runAuthOperation("login", () => Promise.resolve("ran")).result).resolves.toBe(
      "ran",
    );
  });

  test("sign-out empties the query cache", async () => {
    const { app } = await openShell();
    await userEvent.click(menuButton());

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await screen.findByRole("heading", { level: 1, name: "Inicia sesión" });
    expect(app.queryClient.getQueryCache().getAll()).toEqual([]);
  });

  test("an expired session still signs out (the API answers 204 either way)", async () => {
    await openShell(makeMe(), { [LOGOUT]: noContent(204) });
    await userEvent.click(menuButton());

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Inicia sesión" })).toBeDefined();
  });

  test("a network failure keeps the user signed in and says so", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setOrganizationSlug("norte");
    const { app } = await openShell(makeMe(), {
      [LOGOUT]: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await userEvent.click(menuButton());

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No hay conexión con el servidor",
    );
    expect(app.router.state.location.pathname).toBe("/");
    expect(getOrganizationSlug()).toBe("norte");
  });

  test("a CSRF rejection is retried once with a fresh token", async () => {
    let attempts = 0;
    await openShell(makeMe(), {
      [LOGOUT]: () => {
        attempts += 1;
        return attempts === 1 ? apiError(403, "permission_denied") : noContent(204);
      },
      "GET /api/v1/auth/csrf/": noContent(204),
    });
    await userEvent.click(menuButton());

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Inicia sesión" })).toBeDefined();
    expect(attempts).toBe(2);
  });
});
