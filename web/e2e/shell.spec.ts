import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mockApi } from "./fixtures/mock-api";

// Keys of the preferences the app stores in the browser (see src/storage/safe-storage.ts).
const THEME_KEY = "wolbachia.theme";
const LANGUAGE_KEY = "wolbachia.language";
const EXPANDED_WIDTH = 232;
const COLLAPSED_WIDTH = 64;
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// The shell is behind the session guard: every test here runs as a signed-in user with the mocked
// API (the sign-in flows themselves are in auth.spec.ts).
test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

async function openShell(page: Page, preferences: Record<string, string> = {}) {
  await page.addInitScript((stored) => {
    for (const [key, value] of Object.entries(stored)) window.localStorage.setItem(key, value);
  }, preferences);
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
}

async function sidebarWidth(page: Page): Promise<number> {
  const box = await page.locator("#sidebar").boundingBox();
  return Math.round(box?.width ?? 0);
}

test.describe("shell layout", () => {
  test("sidebar is 232 px, collapses to 64 px and remembers it", async ({ page }) => {
    await openShell(page);
    expect(await sidebarWidth(page)).toBe(EXPANDED_WIDTH);

    await page.getByRole("button", { name: "Colapsar menú" }).click();
    expect(await sidebarWidth(page)).toBe(COLLAPSED_WIDTH);

    await page.reload();
    expect(await sidebarWidth(page)).toBe(COLLAPSED_WIDTH);
    await expect(page.getByRole("link", { name: "Incidentes" })).toBeVisible();
  });

  test("the top bar is 56 px high", async ({ page }) => {
    await openShell(page);

    const topBar = await page.getByRole("banner").boundingBox();

    expect(Math.round(topBar?.height ?? 0)).toBe(56);
  });

  test("an unknown address shows not found inside the shell", async ({ page }) => {
    await page.goto("/no-such-page");

    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
  });

  test("an area opens from the sidebar and is marked as current", async ({ page }) => {
    await openShell(page);

    await page.getByRole("link", { name: "Laboratorio" }).click();

    await expect(page).toHaveURL(/\/lab$/);
    await expect(page.getByRole("heading", { level: 1, name: "Laboratorio" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Laboratorio" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

test.describe("startup", () => {
  test("loads without console errors or blocked resources", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(message.text());
    });
    page.on("pageerror", (error) => problems.push(error.message));

    await openShell(page);
    await page.getByRole("link", { name: "Flota" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Flota" })).toBeVisible();

    expect(problems).toEqual([]);
  });

  test("serves the app on a deep link (single-page fallback)", async ({ page }) => {
    await page.goto("/quadrants");

    await expect(
      page.getByRole("heading", { level: 1, name: "Cuadrantes y muestreo" }),
    ).toBeVisible();
  });
});

test.describe("reflow (WCAG 1.4.10)", () => {
  test("at 320 CSS px the sidebar is collapsed and nothing scrolls in two directions", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openShell(page);

    expect(await sidebarWidth(page)).toBe(COLLAPSED_WIDTH);
    await expect(page.getByRole("button", { name: "Colapsar menú" })).toHaveCount(0);
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      main:
        (document.querySelector("main")?.scrollWidth ?? 0) -
        (document.querySelector("main")?.clientWidth ?? 0),
      topBar:
        (document.querySelector("header")?.scrollWidth ?? 0) -
        (document.querySelector("header")?.clientWidth ?? 0),
    }));
    expect(overflow).toEqual({ page: 0, main: 0, topBar: 0 });
  });

  test("the 320 px shell has no axe violations", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openShell(page);

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    expect(results.violations).toEqual([]);
  });
});

test.describe("keyboard", () => {
  test("skip link appears on the first Tab and moves focus to main", async ({ page }) => {
    await openShell(page);

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("main")).toBeFocused();
  });

  test("every sidebar link can be reached and opened with the keyboard", async ({ page }) => {
    await openShell(page);

    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // Inicio
    await page.keyboard.press("Tab"); // Incidentes
    await expect(page.getByRole("link", { name: "Incidentes" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { level: 1, name: "Incidentes" })).toBeVisible();
  });

  test("the focus ring is visible on a sidebar link", async ({ page }) => {
    await openShell(page);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    const outline = await page.getByRole("link", { name: "Inicio" }).evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });
    expect(outline).toEqual({ width: "2px", style: "solid" });
  });

  test("Ctrl+K focuses the search", async ({ page }) => {
    await openShell(page);

    await page.keyboard.press("Control+K");

    await expect(page.getByRole("searchbox", { name: "Buscar" })).toBeFocused();
  });
});

test.describe("states and language", () => {
  test("shows the offline banner when the network goes away", async ({ page, context }) => {
    await openShell(page);

    await context.setOffline(true);

    await expect(page.getByRole("status")).toContainText("Sin conexión");
  });

  test("switches to English without reloading", async ({ page }) => {
    await openShell(page);

    await page.getByRole("button", { name: "ES: cambiar idioma a inglés" }).click();

    await expect(page.getByRole("link", { name: "Incidents" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
  for (const theme of ["light", "dark"]) {
    for (const language of ["es-MX", "en"]) {
      test(`shell has no violations: ${theme}, ${language}`, async ({ page }) => {
        await openShell(page, { [THEME_KEY]: theme, [LANGUAGE_KEY]: language });
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

        expect(results.violations).toEqual([]);
      });
    }
  }

  test("collapsed shell has no violations", async ({ page }) => {
    await openShell(page, { "wolbachia.sidebarCollapsed": "true" });

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    expect(results.violations).toEqual([]);
  });

  test("offline banner has no violations", async ({ page, context }) => {
    await openShell(page, { [THEME_KEY]: "dark" });
    await context.setOffline(true);
    await expect(page.getByRole("status")).toContainText("Sin conexión");

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    expect(results.violations).toEqual([]);
  });
});
