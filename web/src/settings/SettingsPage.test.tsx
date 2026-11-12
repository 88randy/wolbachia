import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { createFakeApi, makeMe } from "../test/fake-api";
import { CATALOG, ITEMS_PATH, catalogRows } from "../test/catalog-fixtures";
import { pageOf } from "../test/rules-fixtures";
import { renderApp } from "../test/render-app";
test("settings exposes permitted cards and navigation retains the shell with current breadcrumbs and one user menu", async () => {
  const me = makeMe({ permissions: ["catalog.read"] });
  const api = createFakeApi({
    "GET /api/v1/me/": Response.json(me),
    "GET /api/v1/catalogs/": () => pageOf([CATALOG]),
    [`GET ${ITEMS_PATH}`]: () => pageOf(catalogRows()),
  });
  await renderApp({ path: "/settings", fetch: api.fetch });
  const shellBanner = () =>
    screen.getAllByRole("banner").find((candidate) => !candidate.closest("main"));
  const header = shellBanner();
  const main = within(screen.getByRole("main"));
  expect(main.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "CatálogosOrganiza las opciones que usa el equipo en campo.",
  ]);
  expect(main.queryByText(/construcción/)).toBeNull();
  expect(screen.getAllByRole("button", { name: /Menú de usuario/ })).toHaveLength(1);
  await userEvent.setup().click(main.getByRole("link", { name: /Catálogos/ }));
  expect(await screen.findByRole("table", { name: "Catálogos" })).toBeDefined();
  const trail = screen.getByRole("navigation", { name: "Ruta de navegación" });
  expect(within(trail).getByRole("link", { name: "Configuración" })).toBeDefined();
  expect(trail.querySelector('[aria-current="page"]')?.textContent).toBe("Intervenciones");
  expect(shellBanner()).toBe(header);
});
