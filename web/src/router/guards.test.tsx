import { screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { clearOrganizationSlug } from "../session/organization-slug";
import { apiError, createFakeApi, makeMe } from "../test/fake-api";
import { renderApp } from "../test/render-app";

beforeEach(() => {
  clearOrganizationSlug();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function pathOf(app: Awaited<ReturnType<typeof renderApp>>) {
  const { pathname, search } = app.router.state.location;
  return { pathname, search };
}

describe("session guard", () => {
  test("a visitor without a session goes to sign in and the target is remembered", async () => {
    const app = await renderApp({ path: "/settings", me: null });

    expect(pathOf(app)).toEqual({ pathname: "/login", search: { redirect: "/settings" } });
    expect(await screen.findByRole("heading", { name: "Inicia sesión" })).toBeDefined();
  });

  test("the target keeps its query string", async () => {
    const app = await renderApp({ path: "/incidents?page=2", me: null });

    expect(pathOf(app).search).toEqual({ redirect: "/incidents?page=2" });
  });

  test("Home needs no redirect parameter", async () => {
    const app = await renderApp({ path: "/", me: null });

    expect(pathOf(app)).toEqual({ pathname: "/login", search: {} });
  });

  test("an unknown address behind no session also asks for sign-in first", async () => {
    const app = await renderApp({ path: "/does-not-exist", me: null });

    expect(pathOf(app).pathname).toBe("/login");
  });

  test("a signed-in user with no active membership goes to sign in with a notice", async () => {
    const api = createFakeApi({ "GET /api/v1/me/": apiError(403, "no_active_membership") });

    const app = await renderApp({ path: "/", fetch: api.fetch });

    expect(pathOf(app)).toEqual({ pathname: "/login", search: { notice: "no-membership" } });
  });

  test("a failure that is not about the session shows the error state with retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const api = createFakeApi({ "GET /api/v1/me/": apiError(500, "server_error") });

    await renderApp({ path: "/", fetch: api.fetch });

    expect(
      await screen.findByRole("heading", { name: "Algo salió mal en esta pantalla" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDefined();
  });
});

describe("organization guard", () => {
  const chooser = makeMe({
    organization: null,
    profiles: [],
    permissions: [],
    organizations: [
      { slug: "norte", name: "Región Norte" },
      { slug: "sur", name: "Región Sur" },
    ],
  });

  test("a user with several organizations who chose none goes to choose one", async () => {
    const app = await renderApp({ path: "/settings", me: chooser });

    expect(pathOf(app)).toEqual({
      pathname: "/select-organization",
      search: { redirect: "/settings" },
    });
  });

  test("a user with one organization never sees the chooser", async () => {
    const app = await renderApp({ path: "/select-organization", me: makeMe() });

    expect(pathOf(app).pathname).toBe("/");
  });

  test("a multi-organization user who already chose may reopen the chooser", async () => {
    const chosen = makeMe({ organizations: chooser.organizations });

    const app = await renderApp({ path: "/select-organization", me: chosen });

    expect(pathOf(app).pathname).toBe("/select-organization");
  });

  test("the chooser itself asks for sign-in when there is no session", async () => {
    const app = await renderApp({ path: "/select-organization", me: null });

    expect(pathOf(app).pathname).toBe("/login");
  });
});

describe("permission guard", () => {
  const withoutPermissions = makeMe({ permissions: [] });

  test("a deep link to a forbidden area shows no-permission inside the shell, not a crash", async () => {
    await renderApp({ path: "/settings", me: withoutPermissions });

    expect(
      await screen.findByRole("heading", { level: 1, name: "No tienes acceso a esta sección" }),
    ).toBeDefined();
    const main = screen.getByRole("main");
    expect(within(main).getByText("Configuración")).toBeDefined();
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeDefined();
    expect(document.title).toBe("No tienes acceso a esta sección · AedesVision");
  });

  test("offers the way home", async () => {
    await renderApp({ path: "/settings", me: withoutPermissions });

    const main = await screen.findByRole("main");

    expect(within(main).getByRole("link", { name: "Ir al inicio" }).getAttribute("href")).toBe("/");
  });

  test("is translated to English", async () => {
    await renderApp({ path: "/settings", me: withoutPermissions, language: "en" });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "You don't have access to this section",
      }),
    ).toBeDefined();
  });

  test("a user with one of the codes opens the area", async () => {
    await renderApp({ path: "/settings", me: makeMe({ permissions: ["device.read"] }) });

    expect(await screen.findByRole("heading", { level: 1, name: "Configuración" })).toBeDefined();
  });

  test("the no-permission state has no axe violations", async () => {
    const { container } = await renderApp({ path: "/settings", me: withoutPermissions });
    await screen.findByRole("heading", { level: 1, name: "No tienes acceso a esta sección" });

    expect(await axe(container)).toHaveNoViolations();
  });
});
