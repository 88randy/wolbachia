import { expect, test } from "@playwright/test";
import { E2E_PASSWORD, mockApi } from "./fixtures/mock-api";
import { expireWhileWorking } from "./fixtures/scenarios";

test.describe("session expiry", () => {
  test("a 401 after sign-in asks for the password over the page and keeps the draft", async ({
    page,
  }) => {
    const api = await mockApi(page, { login: "ok" });
    await expireWhileWorking(page, api);

    const dialog = page.getByRole("dialog", { name: "Tu sesión terminó" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Usuario")).toHaveValue("ana.supervisora");
    await expect(dialog.getByLabel("Contraseña", { exact: true })).toBeFocused();
    await expect(page.locator("#global-search")).toHaveValue("borrador sin guardar");
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("focus stays inside the dialog and Escape does not close it", async ({ page }) => {
    const api = await mockApi(page);
    await expireWhileWorking(page, api);
    const dialog = page.getByRole("dialog", { name: "Tu sesión terminó" });
    await expect(dialog).toBeVisible();

    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press("Tab");
      // Inside the dialog, or on the page itself while the browser's own UI has focus: the inert
      // page behind never receives it.
      const isContained = await page.evaluate(
        () =>
          document.activeElement === document.body ||
          document.activeElement?.closest("dialog") !== null,
      );
      expect(isContained).toBe(true);
    }
    await page.keyboard.press("Escape");

    await expect(dialog).toBeVisible();
  });

  test("signing in again closes it and returns focus to where the user was", async ({ page }) => {
    const api = await mockApi(page);
    await expireWhileWorking(page, api);
    const dialog = page.getByRole("dialog", { name: "Tu sesión terminó" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
    await page.keyboard.press("Enter");

    await expect(dialog).toBeHidden();
    await expect(page.locator("#global-search")).toBeFocused();
    await expect(page.locator("#global-search")).toHaveValue("borrador sin guardar");
  });

  test("a wrong password is explained and the dialog stays", async ({ page }) => {
    const api = await mockApi(page, { login: "invalid" });
    await expireWhileWorking(page, api);
    const dialog = page.getByRole("dialog", { name: "Tu sesión terminó" });

    await dialog.getByLabel("Contraseña", { exact: true }).fill(E2E_PASSWORD);
    await dialog.getByRole("button", { name: "Continuar" }).click();

    await expect(dialog.getByRole("alert")).toContainText(
      "El usuario o la contraseña no coinciden.",
    );
    await expect(dialog).toBeVisible();
  });

  test("Sign out from the dialog goes to sign-in", async ({ page }) => {
    const api = await mockApi(page);
    await expireWhileWorking(page, api);

    await page.getByRole("dialog").getByRole("button", { name: "Cerrar sesión" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Inicia sesión" })).toBeVisible();
  });
});
