import { expect, test } from "./fixtures/test";
import { CATALOG_ADMIN } from "../src/test/catalog-fixtures";
import { mockApi } from "./fixtures/mock-api";
import { mockCatalogs } from "./fixtures/catalogs-mock";
import { expectNoAxeViolations, rememberPreferences, THEMES, LANGUAGES } from "./fixtures/a11y";

test("W63: add, edit, keyboard reorder, cancel a drag, deactivate with Undo", async ({ page }) => {
  await mockApi(page, { me: CATALOG_ADMIN });
  await mockCatalogs(page);
  await page.goto("/settings/catalogs");
  await expect(page).toHaveURL(/\/settings\/catalogs\/intervention-type$/);
  const rows = page.getByRole("table").getByRole("row");
  await expect(rows.last()).toContainText("Otro (especificar)");
  const search = page.getByRole("textbox", { name: "Buscar código o etiqueta" });
  await search.fill("Rociado");
  const filteredRead = page.waitForRequest(
    (request) =>
      request.method() === "GET" && new URL(request.url()).searchParams.get("search") === "Rociado",
  );
  await search.press("Enter");
  await filteredRead;
  await expect(rows).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Reordenar: Rociado" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  const availability = page.getByRole("group", { name: "Estado" });
  await page.getByRole("button", { name: "Limpiar filtros", exact: true }).click();
  await expect(availability.getByRole("button", { name: "Todos", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(rows.last()).toContainText("Otro (especificar)");
  const ordering = page.getByRole("combobox", { name: "Ordenar por", exact: true });
  const sortedRead = page.waitForRequest(
    (request) =>
      request.method() === "GET" &&
      new URL(request.url()).searchParams.get("ordering") === "-usage_count",
  );
  await ordering.selectOption("-usage_count");
  await sortedRead;
  await expect(page.getByRole("columnheader", { name: /En uso/ })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await ordering.selectOption("");
  await expect(page.getByRole("button", { name: "Reordenar: Rociado" })).toHaveAttribute(
    "aria-disabled",
    "false",
  );
  await page.getByRole("button", { name: "Agregar elemento" }).click();
  const cancelBox = await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar", exact: true })
    .boundingBox();
  const saveBox = await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar", exact: true })
    .boundingBox();
  if (!cancelBox || !saveBox) throw new Error("Dialog actions must be visible.");
  expect(Math.abs(cancelBox.width - saveBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(cancelBox.height - saveBox.height)).toBeLessThanOrEqual(1);
  await page.getByLabel("Código", { exact: true }).fill("new");
  await page.getByLabel("Etiqueta en español (obligatoria)", { exact: true }).fill("Nueva");
  await page.getByLabel("Etiqueta en inglés", { exact: true }).fill("New");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  let added = page.getByRole("row", { name: /Nueva/ });
  await added.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Etiqueta en español (obligatoria)", { exact: true }).fill("Actualizada");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  added = page.getByRole("row", { name: /Actualizada/ });
  const handle = added.getByRole("button", { name: "Reordenar: Actualizada" });
  await handle.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Deshacer", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await handle.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Escape");
  await expect(handle).toBeFocused();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await ordering.click();
  await ordering.selectOption("-code");
  await expect(handle).toHaveAttribute("aria-pressed", "false");
  await expect(ordering).toBeFocused();
  await ordering.selectOption("");
  await expect(handle).toHaveAttribute("aria-disabled", "false");
  await handle.dragTo(page.getByRole("button", { name: "Reordenar: Rociado" }));
  await expect(rows.nth(1)).toContainText("Actualizada");
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await added.getByRole("button", { name: "Desactivar", exact: true }).click();
  await expect(added).toContainText("Desactivado");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(added).toContainText("Activo");
  await expect(rows.last()).toContainText("Otro (especificar)");
  await expectNoAxeViolations(page);
});

for (const theme of THEMES) {
  for (const language of LANGUAGES) {
    test(`W63 axe: ${theme}, ${language}, table and dialogs`, async ({ page }) => {
      await rememberPreferences(page, theme, language);
      await mockApi(page, { me: CATALOG_ADMIN });
      await mockCatalogs(page);
      await page.goto("/settings/catalogs/intervention-type");
      await expect(page.getByRole("row", { name: /spraying/ })).toBeVisible();
      await expectNoAxeViolations(page);
      await page
        .getByRole("button", {
          name: language === "en" ? "Add item" : "Agregar elemento",
          exact: true,
        })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoAxeViolations(page);
      await page.keyboard.press("Escape");
      await page
        .getByRole("row", { name: /spraying/ })
        .getByRole("button", { name: language === "en" ? "Edit" : "Editar", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: language === "en" ? "Cancel" : "Cancelar" }),
      ).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }
}
