import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, test, vi } from "vitest";
import { setupI18n } from "../i18n/setup-i18n";
import { PendingState } from "../states/PendingState";
import { RouteErrorState } from "../states/RouteErrorState";
import { renderApp } from "../test/render-app";
import { renderWithI18n } from "../test/render-with-i18n";
import { makeMe } from "../test/fake-api";
import { AREAS } from "./areas";

afterEach(() => {
  vi.restoreAllMocks();
});

const AREA_TITLES_ES: Record<(typeof AREAS)[number]["id"], string> = {
  home: "Inicio",
  incidents: "Incidentes",
  operations: "Supervisión",
  quadrants: "Cuadrantes y muestreo",
  releases: "Liberaciones",
  community: "Comunidad",
  inventory: "Inventario",
  fleet: "Flota",
  lab: "Laboratorio",
  people: "Personal",
  dashboards: "Tableros",
  regulatory: "Regulatorio",
  settings: "Configuración",
};
const OPERATIONS_ME = makeMe({
  permissions: ["review_item.read"],
  scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
});

describe("area routes", () => {
  test.each(
    AREAS.filter(
      ({ id }) =>
        ![
          "quadrants",
          "settings",
          "inventory",
          "incidents",
          "operations",
          "people",
          "lab",
        ].includes(id),
    ),
  )("$path opens the placeholder of $id", async ({ path, id }) => {
    await renderApp({ path, me: makeMe({ permissions: ["catalog.read", "motorcycle.read"] }) });

    expect(
      await screen.findByRole("heading", { level: 1, name: AREA_TITLES_ES[id] }),
    ).toBeDefined();
    expect(screen.getByText("Esta sección todavía está en construcción.")).toBeDefined();
  });

  test("/operations opens the permitted workflow instead of a placeholder", async () => {
    await renderApp({ path: "/operations", me: OPERATIONS_ME });

    expect(await screen.findByRole("heading", { level: 1, name: "Operación" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Bandeja de revisión" }).getAttribute("href")).toBe(
      "/operations/reviews",
    );
    expect(screen.queryByText("Esta sección todavía está en construcción.")).toBeNull();
  });

  test("there is one route per area and all paths are different", () => {
    const paths = AREAS.map((area) => area.path);

    expect(new Set(paths).size).toBe(AREAS.length);
    expect(AREAS).toHaveLength(13);
  });

  test("the laboratory home exposes only its permitted implemented workspace", async () => {
    await renderApp({ path: "/lab", me: makeMe({ permissions: ["egg_count.read"] }) });

    expect(await screen.findByRole("heading", { level: 1, name: "Laboratorio" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Historial de conteos" }).getAttribute("href")).toBe(
      "/lab/count-history",
    );
    expect(screen.queryByRole("link", { name: "Conteo de huevos" })).toBeNull();
    expect(screen.queryByText("Esta sección todavía está en construcción.")).toBeNull();
  });

  test("an unknown address shows the not-found state with a way home", async () => {
    await renderApp({ path: "/does-not-exist" });

    expect(
      await screen.findByRole("heading", { name: "No encontramos esta página" }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Ir al inicio" }).getAttribute("href")).toBe("/");
  });

  test("the area title is translated to English", async () => {
    await renderApp({ path: "/operations", language: "en", me: OPERATIONS_ME });

    expect(await screen.findByRole("heading", { level: 1, name: "Operations" })).toBeDefined();
  });
});

async function renderThrowingRoute() {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const rootRoute = createRootRoute();
  let shouldThrow = true;
  const brokenRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => {
      if (shouldThrow) throw new Error("boom");
      return <h1>recovered</h1>;
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([brokenRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    defaultErrorComponent: RouteErrorState,
  });
  const instance = await setupI18n("es-MX");
  render(
    <I18nextProvider i18n={instance}>
      <RouterProvider router={router} />
    </I18nextProvider>,
  );
  return () => {
    shouldThrow = false;
  };
}

describe("route error state", () => {
  test("explains the failure, logs it and offers retry and home", async () => {
    await renderThrowingRoute();

    expect(
      await screen.findByRole("heading", { name: "Algo salió mal en esta pantalla" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Ir al inicio" })).toBeDefined();
    expect(console.error).toHaveBeenCalledWith("A route failed to render", expect.any(Error));
  });

  test("retry renders the screen again", async () => {
    const fix = await renderThrowingRoute();
    await screen.findByRole("button", { name: "Reintentar" });

    fix();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("heading", { name: "recovered" })).toBeDefined();
  });
});

describe("pending state", () => {
  test("announces loading with a skeleton instead of a blank page", async () => {
    await renderWithI18n(<PendingState />);

    expect(screen.getByRole("status", { name: "Cargando contenido" })).toBeDefined();
  });
});

describe("document title (WCAG 2.4.2)", () => {
  test("each area sets its own title", async () => {
    await renderApp({ path: "/operations", me: OPERATIONS_ME });

    expect(document.title).toBe("Operación · Wolbachia");
  });

  test("navigating changes the title", async () => {
    await renderApp({ me: makeMe({ permissions: ["egg_count.read"] }) });
    expect(document.title).toBe("Inicio · Wolbachia");

    await userEvent.click(screen.getByRole("link", { name: "Laboratorio" }));

    await screen.findByRole("heading", { level: 1, name: "Laboratorio" });
    expect(document.title).toBe("Laboratorio · Wolbachia");
  });

  test("not found has a translated title", async () => {
    await renderApp({ path: "/nope", language: "en" });

    expect(document.title).toBe("We couldn't find this page · Wolbachia");
  });

  test("a route error sets the error title", async () => {
    await renderThrowingRoute();

    await screen.findByRole("heading", { name: "Algo salió mal en esta pantalla" });
    expect(document.title).toBe("Algo salió mal en esta pantalla · Wolbachia");
  });
});
