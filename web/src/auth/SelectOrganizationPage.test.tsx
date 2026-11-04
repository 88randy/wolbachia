import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  clearOrganizationSlug,
  getOrganizationSlug,
  setOrganizationSlug,
} from "../session/organization-slug";
import { apiError, createFakeApi, makeMe } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { renderApp } from "../test/render-app";

const ME = "GET /api/v1/me/";
const ORGANIZATIONS = [
  { slug: "norte", name: "Región Norte" },
  { slug: "sur", name: "Región Sur" },
];

/** What the API does: no header and several memberships -> no organization; a header picks one. */
function meFor(request: { headers: Headers }): Response {
  const slug = request.headers.get("X-Organization");
  const chosen = ORGANIZATIONS.find((organization) => organization.slug === slug);
  if (chosen === undefined) {
    return Response.json(
      makeMe({ organization: null, profiles: [], permissions: [], organizations: ORGANIZATIONS }),
    );
  }
  const base = makeMe({ organizations: ORGANIZATIONS });
  return Response.json({
    ...base,
    organization: { ...base.organization, slug: chosen.slug, name: chosen.name },
  });
}

async function openChooser(routes: FakeApiRoutes = {}, path = "/select-organization") {
  const api = createFakeApi({ [ME]: meFor, ...routes });
  const app = await renderApp({ path, fetch: api.fetch });
  await screen.findByRole("heading", { level: 1, name: "Elige tu organización" });
  return { api, app };
}

beforeEach(() => {
  clearOrganizationSlug();
  window.localStorage.clear();
});

describe("organization selection", () => {
  test("lists the user's organizations as a radio group, the first one chosen", async () => {
    await openChooser();

    const group = screen.getByRole("group", { name: "Organizaciones disponibles" });
    const options = screen.getAllByRole("radio");
    expect(group).toBeDefined();
    expect(options.map((option) => option.closest("label")?.textContent)).toEqual([
      "Región Norte",
      "Región Sur",
    ]);
    expect(screen.getByRole("radio", { name: "Región Norte" })).toHaveProperty("checked", true);
  });

  test("choosing one stores the slug, sends it as X-Organization and continues to the target", async () => {
    const { api, app } = await openChooser({}, "/select-organization?redirect=%2Fsettings");
    api.requests.length = 0;

    await userEvent.click(screen.getByRole("radio", { name: "Región Sur" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await vi.waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/settings");
    });
    expect(getOrganizationSlug()).toBe("sur");
    const meRequests = api.requests.filter((request) => request.path === "/api/v1/me/");
    expect(meRequests).toHaveLength(1);
    expect(meRequests[0]?.headers.get("X-Organization")).toBe("sur");
  });

  test("the slug travels only in the header, never in a URL or a body", async () => {
    const { api } = await openChooser();

    await userEvent.click(screen.getByRole("radio", { name: "Región Sur" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await vi.waitFor(() => {
      expect(getOrganizationSlug()).toBe("sur");
    });
    for (const request of api.requests) {
      expect(request.path).not.toContain("sur");
      expect(JSON.stringify(request.body ?? "")).not.toContain("sur");
    }
  });

  test("clears the cache of the previous organization", async () => {
    const { app } = await openChooser();
    app.queryClient.setQueryData(["incidents", "list"], [{ id: "x" }]);

    await userEvent.click(screen.getByRole("radio", { name: "Región Sur" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await vi.waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/");
    });
    expect(app.queryClient.getQueryData(["incidents", "list"])).toBeUndefined();
  });

  test("an external redirect target is ignored", async () => {
    const { app } = await openChooser({}, "/select-organization?redirect=%2F%2Fevil.example");

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await vi.waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/");
    });
  });

  test("a user who is changing organization sees the current one chosen", async () => {
    setOrganizationSlug("sur");

    await openChooser();

    expect(screen.getByRole("radio", { name: "Región Sur" })).toHaveProperty("checked", true);
  });

  test("a 401 while choosing sends the user to sign in, keeping the target", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let calls = 0;
    const { app } = await openChooser(
      {
        [ME]: (request) => {
          calls += 1;
          return calls === 1 ? meFor(request) : apiError(401, "not_authenticated");
        },
      },
      "/select-organization?redirect=%2Fsettings",
    );

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await vi.waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/login");
    });
    expect(app.router.state.location.search).toEqual({ redirect: "/settings" });
  });

  test("a failure refreshing /me/ is reported and the user stays", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let calls = 0;
    const { app } = await openChooser({
      [ME]: (request) => {
        calls += 1;
        return calls === 1 ? meFor(request) : apiError(500, "server_error");
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Algo falló de nuestro lado");
    expect(document.activeElement).toBe(alert);
    expect(app.router.state.location.pathname).toBe("/select-organization");
  });

  test.each(["es-MX", "en"] as const)("has no axe violations in %s", async (language) => {
    const api = createFakeApi({ [ME]: meFor });
    const { container } = await renderApp({
      path: "/select-organization",
      fetch: api.fetch,
      language,
    });
    await screen.findByRole("heading", { level: 1 });

    expect(await axe(container)).toHaveNoViolations();
  });
});
