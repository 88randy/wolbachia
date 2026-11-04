import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { makeMe } from "../src/test/fake-api";
import { makePhone, makePhones } from "./fixtures/devices-mock";
import { expectNoHorizontalScroll } from "./fixtures/a11y";
import { mockApi } from "./fixtures/mock-api";

const PHONES = "/settings/phones";
const ADMIN = makeMe({ permissions: ["device.read"] });
const PAGE_SIZE = 25;
const MOBILE_WIDTH = 320;
const MOBILE_HEIGHT = 700;

const ROSA = makePhone({
  label: "Teléfono de Rosa",
  last_user_username: "rosa",
  app_version: "1.3.0",
});
const LUIS = makePhone({ label: "Teléfono de Luis", last_user_username: "luis" });
const PEDRO = makePhone({
  label: "Teléfono de Pedro",
  last_user_username: "pedro",
  is_revoked: true,
  revoked_at: "2026-11-02T10:00:00Z",
});

const search = (page: Page) => new URL(page.url()).search;

test.describe("phones list (W67)", () => {
  test("lists the phones with the date in the organization's time zone and nothing to edit", async ({
    page,
  }) => {
    await mockApi(page, { me: ADMIN, devices: [LUIS, ROSA, PEDRO] });

    await page.goto(PHONES);

    await expect(page.getByRole("heading", { level: 1, name: "Teléfonos" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Teléfonos registrados" })).toBeVisible();
    const luis = page.getByRole("row", { name: /Teléfono de Luis/ });
    await expect(luis).toContainText("luis");
    await expect(luis).toContainText("1.4.0");
    await expect(luis).toContainText("3 nov 2026");
    await expect(luis).toContainText("Activo");
    await expect(page.getByRole("row", { name: /Teléfono de Pedro/ })).toContainText("Revocado");
    await expect(page.getByText("Mostrando 1 a 3 de 3")).toBeVisible();
    await expect(page.getByRole("button", { name: /revocar|subir|publicar/i })).toHaveCount(0);
  });

  test("says it is loading until the server answers, then shows the rows", async ({ page }) => {
    const api = await mockApi(page, { me: ADMIN, devices: [LUIS] });
    const release = api.devices.hold();

    await page.goto(PHONES);
    await expect(page.getByText("Cargando resultados")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    release();

    await expect(page.getByRole("row", { name: /Teléfono de Luis/ })).toBeVisible();
    await expect(page.getByText("Mostrando 1 a 1 de 1")).toBeVisible();
  });

  test("the status filter is in the address, shows a chip and the back button undoes it", async ({
    page,
  }) => {
    await mockApi(page, { me: ADMIN, devices: [LUIS, ROSA, PEDRO] });
    await page.goto(PHONES);
    await expect(page.getByRole("row", { name: /Teléfono de Luis/ })).toBeVisible();

    await page.getByRole("combobox", { name: "Estado" }).selectOption({ label: "Revocado" });

    await expect(page.getByRole("row", { name: /Teléfono de Pedro/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Teléfono de Luis/ })).toHaveCount(0);
    expect(search(page)).toBe("?is_revoked=true");
    await expect(
      page.getByRole("button", { name: "Quitar filtro Estado: Revocado" }),
    ).toBeVisible();

    await page.goBack();

    await expect(page.getByRole("row", { name: /Teléfono de Luis/ })).toBeVisible();
    expect(search(page)).toBe("");
    await expect(page.getByRole("combobox", { name: "Estado" })).toHaveValue("");
  });

  test("a chip and Clear filters remove the filter", async ({ page }) => {
    await mockApi(page, { me: ADMIN, devices: [LUIS, PEDRO] });
    await page.goto(`${PHONES}?is_revoked=true`);
    await expect(page.getByRole("row", { name: /Teléfono de Pedro/ })).toBeVisible();

    await page.getByRole("button", { name: "Limpiar filtros" }).click();

    await expect(page.getByRole("row", { name: /Teléfono de Luis/ })).toBeVisible();
    expect(search(page)).toBe("");
    await expect(page.getByRole("list", { name: "Filtros activos" })).toHaveCount(0);
  });

  test("filtering to nothing says so and offers to clear the filters", async ({ page }) => {
    await mockApi(page, { me: ADMIN, devices: [LUIS] });
    await page.goto(`${PHONES}?is_revoked=true`);

    await expect(page.getByText("Sin resultados con estos filtros")).toBeVisible();
    await page.getByRole("main").getByRole("button", { name: "Limpiar filtros" }).first().click();

    await expect(page.getByRole("row", { name: /Teléfono de Luis/ })).toBeVisible();
  });

  test("pages through the list with the keyboard and keeps the page in the address", async ({
    page,
  }) => {
    await mockApi(page, { me: ADMIN, devices: makePhones(60) });
    await page.goto(PHONES);
    await expect(page.getByText("Página 1 de 3")).toBeVisible();
    await expect(page.getByRole("row", { name: /Teléfono 01/ })).toBeVisible();
    const next = page.getByRole("button", { name: "Siguiente" });

    await next.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByText("Página 2 de 3")).toBeVisible();
    await expect(page.getByRole("row", { name: /Teléfono 26/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Teléfono 01/ })).toHaveCount(0);
    await expect(page.getByText(`Mostrando ${String(PAGE_SIZE + 1)} a 50 de 60`)).toBeVisible();
    expect(search(page)).toBe("?page=2");
    await expect(next).toBeFocused();

    await page.reload();
    await expect(page.getByText("Página 2 de 3")).toBeVisible();
  });

  test("on the last page Next is unavailable and keeps focus", async ({ page }) => {
    await mockApi(page, { me: ADMIN, devices: makePhones(30) });
    await page.goto(`${PHONES}?page=2`);
    const next = page.getByRole("button", { name: "Siguiente" });

    await next.focus();
    await page.keyboard.press("Enter");

    await expect(next).toHaveAttribute("aria-disabled", "true");
    await expect(next).toBeFocused();
    expect(search(page)).toBe("?page=2");
  });

  test("a page past the end fails clearly and offers the first page", async ({ page }) => {
    await mockApi(page, { me: ADMIN, devices: makePhones(5) });

    await page.goto(`${PHONES}?page=9`);

    await expect(page.getByRole("alert")).toContainText("No encontramos lo que buscas");
    await page.getByRole("button", { name: "Ir a la primera página" }).click();
    await expect(page.getByRole("row", { name: /Teléfono 01/ })).toBeVisible();
    expect(search(page)).toBe("");
  });

  test("a server failure is an alert and Retry recovers", async ({ page }) => {
    const api = await mockApi(page, { me: ADMIN, devices: [LUIS] });
    api.devices.setFailing(true);
    await page.goto(PHONES);
    await expect(page.getByRole("alert")).toContainText("Algo falló de nuestro lado");

    api.devices.setFailing(false);
    await page.getByRole("button", { name: "Reintentar" }).click();

    await expect(page.getByRole("row", { name: /Teléfono de Luis/ })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("a parameter the list does not know is ignored and announced", async ({ page }) => {
    const api = await mockApi(page, { me: ADMIN, devices: [LUIS] });

    await page.goto(`${PHONES}?organization_id=abc`);

    await expect(page.getByText(/no se aplicaron: organization_id/)).toBeVisible();
    await expect(page.getByRole("row", { name: /Teléfono de Luis/ })).toBeVisible();
    const request = api.requests.find((entry) => entry.path === "/api/v1/devices/");
    expect(request).toBeDefined();
    await page.getByRole("button", { name: "Quitar de la dirección" }).click();
    expect(search(page)).toBe("");
  });

  test("a user without device.read sees the no-permission state and the API is not asked", async ({
    page,
  }) => {
    const api = await mockApi(page, { me: makeMe({ permissions: ["catalog.read"] }) });

    await page.goto(PHONES);

    await expect(
      page.getByRole("heading", { name: "No tienes acceso a esta sección" }),
    ).toBeVisible();
    expect(api.requests.some((entry) => entry.path === "/api/v1/devices/")).toBe(false);
  });

  test("Settings links to the list for who may read devices", async ({ page }) => {
    await mockApi(page, { me: ADMIN, devices: [LUIS] });
    await page.goto("/settings");

    await page.getByRole("main").getByRole("link", { name: "Teléfonos" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Teléfonos" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(PHONES);
  });

  test("at 320 px the page does not scroll sideways: the table scrolls in its card", async ({
    page,
  }) => {
    await mockApi(page, { me: ADMIN, devices: [LUIS, ROSA] });
    await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });

    await page.goto(PHONES);

    await expect(page.getByRole("row", { name: /Teléfono de Luis/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("is in English, with dates in the organization's time zone", async ({ page }) => {
    await mockApi(page, { me: ADMIN, devices: [LUIS] });
    await page.addInitScript(() => {
      window.localStorage.setItem("wolbachia.language", "en");
    });

    await page.goto(PHONES);

    await expect(page.getByRole("heading", { level: 1, name: "Phones" })).toBeVisible();
    await expect(page.getByRole("row", { name: /Teléfono de Luis/ })).toContainText("Nov 3, 2026");
    await expect(page.getByText("Showing 1 to 1 of 1")).toBeVisible();
  });
});
