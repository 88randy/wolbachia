import { test, expect } from "./fixtures/test";
import { installInventoryApi } from "./fixtures/inventory-mock";
import type { InventoryMock } from "./fixtures/inventory-mock";
import {
  LANGUAGES,
  THEMES,
  rememberPreferences,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./fixtures/a11y";
import { interceptSyntheticTiles } from "./fixtures/map-runtime";
import { observeMapWorkers, readMapWorkers } from "./fixtures/map-worker-observation";
import {
  INVENTORY_CENTER,
  INVENTORY_LOCATION,
  INVENTORY_OPERATION,
  INVENTORY_ADMISSION,
  inventoryLocation,
} from "../src/test/inventory-fixtures";
import type { Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const small = { width: 320, height: 700 };
async function attachInventoryScreenshot(page: Page, name: string, fullPage = false) {
  const path = test.info().outputPath(name + ".png");
  await page.screenshot({ path, fullPage });
  await test.info().attach(name, { path, contentType: "image/png" });
}
async function increaseText(page: Page) {
  await page.evaluate(() => {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const sizes = Array.from(computed).filter(
      (name) => name.startsWith("--web-type-") && name.endsWith("-font-size"),
    );
    for (const name of sizes)
      root.style.setProperty(
        name,
        String(Number.parseFloat(computed.getPropertyValue(name)) * 1.3) + "px",
      );
  });
}
async function expectContainedControls(page: Page) {
  const overflow = await page
    .locator("main input, main select, main button")
    .evaluateAll((controls) =>
      controls
        .filter((control) => {
          if (control.closest("table, [role=tablist]")) return false;
          const main = control.closest("main")?.getBoundingClientRect();
          const box = control.getBoundingClientRect();
          return main && box.width > 0 && (box.left < main.left || box.right > main.right);
        })
        .map((control) => control.outerHTML),
    );
  expect(overflow).toEqual([]);
}
async function expectAdoptionKeyboard(page: Page, language: string) {
  const trigger = page.getByRole("button", {
    name:
      language === "en"
        ? "Adopt current supply configuration"
        : "Adoptar configuración actual del insumo",
    exact: true,
  });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: language === "en" ? "Cancel" : "Cancelar", exact: true }),
  ).toBeFocused();
  await expect(dialog).toHaveCSS("opacity", "1");
  await expectNoAxeViolations(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
}
async function expectContainedMarker(page: Page) {
  const contained = await page.locator(".maplibregl-marker a").evaluateAll(
    (markers) =>
      markers.length > 0 &&
      markers.every((marker) => {
        const map = marker.closest(".maplibregl-map")?.getBoundingClientRect();
        const box = marker.getBoundingClientRect();
        return (
          map &&
          box.left >= map.left &&
          box.right <= map.right &&
          box.top >= map.top &&
          box.bottom <= map.bottom
        );
      }),
  );
  expect(contained).toBe(true);
}
function arrangeEdgeLocations(server: InventoryMock, path: string) {
  if (path !== "/inventory/locations") return;
  server.locationRows = [
    inventoryLocation({ geometry: { type: "Point", coordinates: [-100, 18] } }),
    inventoryLocation({
      id: "00000000-0000-4000-8000-000000000021",
      version: "00000000-0000-4000-8000-000000000022",
      code: "LOC-02",
      name: "Other store",
      geometry: { type: "Point", coordinates: [-98, 20] },
    }),
  ];
}

test("W8–W11 router, incomplete draft, completion, ledger links and real MapLibre worker", async ({
  page,
  baseURL,
}) => {
  const server = await installInventoryApi(page);
  const tiles = await interceptSyntheticTiles(page, baseURL ?? "http://127.0.0.1:4173");
  await observeMapWorkers(page);
  await page.goto("/inventory");
  await page.getByRole("link", { name: "Catálogo de insumos", exact: true }).click();
  await page.getByRole("link", { name: "SUP-01", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Nombre del protocolo" })).toHaveValue(
    "Synthetic protocol",
  );
  await page.goto("/inventory/lots");
  await page.getByRole("button", { name: "Nuevo lote" }).click();
  await page.getByRole("textbox", { name: "Código", exact: true }).fill("LOT-NEW");
  await page
    .getByRole("combobox", { name: "Insumo", exact: true })
    .selectOption({ label: "Synthetic supply" });
  await page.getByRole("combobox", { name: "Centro", exact: true }).selectOption(INVENTORY_CENTER);
  await page
    .getByRole("combobox", { name: "Ubicación inicial", exact: true })
    .selectOption(INVENTORY_LOCATION);
  await page.getByRole("textbox", { name: "Cantidad inicial", exact: true }).fill("2");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByRole("heading", { name: "LOT-NEW", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver requisitos de despacho" }).click();
  await expect(page.getByText("Borrador · no despachable", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Especie", exact: true }).fill("Authored species");
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByText("Guardado en el servidor", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Cantidad inicial", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Volver a la lista", exact: true }).click();
  await page.getByRole("link", { name: "2", exact: true }).click();
  await expect(page.getByText(INVENTORY_ADMISSION, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: INVENTORY_OPERATION, exact: true }).click();
  await expect
    .poll(() =>
      server.reads.some(
        (url) => new URL(url).searchParams.get("operation") === INVENTORY_OPERATION,
      ),
    )
    .toBe(true);
  expect(
    server.reads.some((url) => new URL(url).searchParams.get("operation") === INVENTORY_ADMISSION),
  ).toBe(false);
  expect(server.writes.map((write) => [write.method, write.csrf, write.organization])).toEqual([
    ["POST", "e2e-csrf", "norte"],
    ["PATCH", "e2e-csrf", "norte"],
  ]);
  await page.goto("/inventory/locations");
  await expect(page.getByRole("link", { name: "Synthetic store", exact: false })).toBeVisible();
  await expect.poll(async () => (await readMapWorkers(page)).messages).toBeGreaterThan(0);
  expect((await readMapWorkers(page)).errors).toEqual([]);
  expect(tiles.unexpectedOrigins).toEqual([]);
  await expectNoAxeViolations(page);
});

for (const language of LANGUAGES) {
  for (const theme of THEMES) {
    test(`inventory accessibility, focus and reflow: ${language}, ${theme}`, async ({
      page,
      baseURL,
    }) => {
      await rememberPreferences(page, theme, language);
      const server = await installInventoryApi(page);
      await interceptSyntheticTiles(page, baseURL ?? "http://127.0.0.1:4173");
      await page.setViewportSize(small);
      await page.goto("/inventory/supplies");
      await expect(page.getByRole("link", { name: "SUP-01", exact: true })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectContainedControls(page);
      await expectNoAxeViolations(page);
      await increaseText(page);
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      const create = page.getByRole("button", {
        name: language === "en" ? "New supply" : "Nuevo insumo",
        exact: true,
      });
      await create.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      const code = dialog.getByRole("textbox", {
        name: language === "en" ? "Code" : "Código",
        exact: true,
      });
      await expect(
        dialog.getByRole("button", { name: language === "en" ? "Close" : "Cerrar", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(code).toBeFocused();
      await expect(dialog).toHaveCSS("opacity", "1");
      const focusColors = await code.evaluate((input) => {
        const field = input.parentElement;
        const dialog = input.closest("[role=dialog]");
        if (!field || !dialog) throw new Error("Missing focused field boundary");
        const fieldStyle = getComputedStyle(field);
        return {
          foreground: getComputedStyle(input).color,
          background: fieldStyle.backgroundColor,
          ring: fieldStyle.outlineColor,
          ringStyle: fieldStyle.outlineStyle,
          ringWidth: fieldStyle.outlineWidth,
          adjacent: getComputedStyle(dialog).backgroundColor,
          dialogOpacity: getComputedStyle(dialog).opacity,
        };
      });
      const colorsPath = test.info().outputPath(`151-${language}-${theme}-focus.json`);
      await writeFile(colorsPath, JSON.stringify(focusColors));
      await test
        .info()
        .attach("focused-field-colors", { path: colorsPath, contentType: "application/json" });
      await attachInventoryScreenshot(page, `151-${language}-${theme}-focus`);
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      await page.keyboard.press("Tab");
      await expect(
        dialog.getByRole("textbox", {
          name: language === "en" ? "Supply name" : "Nombre del insumo",
          exact: true,
        }),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(create).toBeFocused();
      for (const path of [
        "/inventory/lots",
        "/inventory/lots/LOT-01",
        "/inventory/locations/LOC-01",
        "/inventory/locations",
      ]) {
        arrangeEdgeLocations(server, path);
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoHorizontalScroll(page);
        await increaseText(page);
        await expectNoHorizontalScroll(page);
        await expectContainedControls(page);
        await expectNoAxeViolations(page);
        if (path === "/inventory/lots/LOT-01") await expectAdoptionKeyboard(page, language);
      }
      await attachInventoryScreenshot(page, `151-${language}-${theme}-320`, true);
      for (const width of [1280, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        await expectNoHorizontalScroll(page);
        await attachInventoryScreenshot(page, `151-${language}-${theme}-${String(width)}`, true);
      }
      const mapMarker = page.getByRole("link", { name: "Synthetic store", exact: false });
      const otherMarker = page.getByRole("link", { name: "Other store", exact: false });
      for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 800 });
        await mapMarker.scrollIntoViewIfNeeded();
        await expectContainedMarker(page);
        await mapMarker.focus();
        await expect(mapMarker).toBeFocused();
        await attachInventoryScreenshot(
          page,
          `151-${language}-${theme}-${String(width)}-map-first`,
        );
        await page.keyboard.press("Tab");
        await expect(otherMarker).toBeFocused();
        await attachInventoryScreenshot(page, `151-${language}-${theme}-${String(width)}-map`);
        await page.keyboard.press("Shift+Tab");
        await expect(mapMarker).toBeFocused();
      }
    });
  }
}
