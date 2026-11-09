import { screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, test } from "vitest";
import { createFakeApi, makeMe } from "../test/fake-api";
import { renderApp } from "../test/render-app";
import { ADMIN, makeParameter, pageOf, requestsTo } from "../test/rules-fixtures";

const ME = "GET /api/v1/me/";
const LIST = "GET /api/v1/rule-parameters/";
const LIST_PATH = "/settings/rule-parameters";

const SPEED = makeParameter({
  key: "speed_lock_kmh",
  unit: "km_h",
  value: 10,
  effective_from: "2026-03-15T06:00:00Z",
  next_change_at: "2026-12-01T06:00:00Z",
});
const FUEL = makeParameter({
  key: "fuel_efficiency_min_km_l",
  value_type: "decimal",
  unit: "km_l",
  value: null,
  effective_from: null,
  version_id: null,
});
const DISTANCE = makeParameter();
const ALL = [DISTANCE, SPEED, FUEL];

async function open(path = LIST_PATH, me = ADMIN, language?: "en") {
  const api = createFakeApi({ [ME]: Response.json(me), [LIST]: pageOf(ALL) });
  const app = await renderApp({ path, fetch: api.fetch, me, ...(language ? { language } : {}) });
  return { api, app };
}

describe("rule parameters list (W62)", () => {
  test("shows each parameter with its name, key, unit, value in force and since when", async () => {
    await open();

    const row = await screen.findByRole("row", { name: /Distancia máxima al punto/ });

    expect(within(row).getByText("max_distance_to_point_m")).toBeDefined();
    expect(within(row).getByText("metros")).toBeDefined();
    expect(within(row).getByText("50")).toBeDefined();
    expect(within(row).getByText("1 ene 2026")).toBeDefined();
    const speed = screen.getByRole("row", { name: /Velocidad que bloquea la captura/ });
    expect(within(speed).getByText("km/h")).toBeDefined();
    expect(within(speed).getByText("1 dic 2026")).toBeDefined();
  });

  test("a parameter with no version is not configured, never shown as zero", async () => {
    await open();

    const row = await screen.findByRole("row", { name: /Rendimiento mínimo de combustible/ });

    expect(within(row).getByText("Sin configurar")).toBeDefined();
    expect(within(row).queryByText("0")).toBeNull();
    expect(within(row).getAllByText("Ninguno")).toHaveLength(2);
  });

  test("a key the web has no name for shows its own code", async () => {
    const api = createFakeApi({
      [ME]: Response.json(ADMIN),
      [LIST]: pageOf([makeParameter({ key: "new_rule_from_backend" })]),
    });
    await renderApp({ path: LIST_PATH, fetch: api.fetch, me: ADMIN });

    expect(await screen.findAllByText("new_rule_from_backend")).toHaveLength(2);
  });

  test("the name and the value link to the page of the parameter by its key", async () => {
    await open();

    const row = await screen.findByRole("row", { name: /Velocidad que bloquea la captura/ });
    const links = within(row).getAllByRole("link");

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/settings/rule-parameters/speed_lock_kmh",
      "/settings/rule-parameters/speed_lock_kmh",
    ]);
  });

  test("forwards key search, unit/type facets and the visible effective-date ordering to the server", async () => {
    const { api } = await open(
      `${LIST_PATH}?search=distance&unit=m&value_type=integer&ordering=-effective_from`,
    );
    await screen.findByRole("row", { name: /Distancia máxima al punto/ });

    const query = new URL(
      requestsTo(api, "GET", "/api/v1/rule-parameters/")[0]?.path ?? "",
      "http://x",
    );
    expect(Object.fromEntries(query.searchParams)).toEqual({
      page: "1",
      page_size: "200",
      search: "distance",
      unit: "m",
      value_type: "integer",
      ordering: "-effective_from",
    });
    expect(
      screen.getByRole("columnheader", { name: /Vigente desde/ }).getAttribute("aria-sort"),
    ).toBe("descending");
  });

  test("a user without rule_parameter.read gets the no-permission state and no request", async () => {
    const { api } = await open(LIST_PATH, makeMe({ permissions: ["catalog.read"] }));

    expect(
      await screen.findByRole("heading", { name: "No tienes acceso a esta sección" }),
    ).toBeDefined();
    expect(requestsTo(api, "GET", "/api/v1/rule-parameters/")).toHaveLength(0);
  });

  test("Settings links to it only for who may read the parameters", async () => {
    await open("/settings");
    const link = await screen.findByRole("link", { name: "Parámetros de reglas" });
    expect(link.getAttribute("href")).toBe(LIST_PATH);
  });

  test("Settings hides the link from a user who may not", async () => {
    await open("/settings", makeMe({ permissions: ["catalog.read"] }));
    await screen.findByRole("heading", { level: 1, name: "Configuración" });

    expect(screen.queryByRole("link", { name: "Parámetros de reglas" })).toBeNull();
  });

  test.each([
    ["es-MX", undefined, "Distancia máxima al punto"],
    ["en", "en" as const, "Maximum distance to the point"],
  ])("has no axe violations in %s", async (_language, language, name) => {
    const { app } = await open(LIST_PATH, ADMIN, language);
    await screen.findByRole("row", { name: new RegExp(name) });

    expect(await axe(app.container)).toHaveNoViolations();
  });
});
