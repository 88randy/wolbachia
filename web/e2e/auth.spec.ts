import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { makeMe } from "../src/test/fake-api";
import { expectNoAxeViolations, expectNoHorizontalScroll } from "./fixtures/a11y";
import { E2E_PASSWORD, mockApi } from "./fixtures/mock-api";

const TWO_ORGANIZATIONS = [
  { slug: "norte", name: "Región Norte" },
  { slug: "sur", name: "Región Sur" },
];

async function fillCredentials(page: Page, password: string = E2E_PASSWORD) {
  await page.getByLabel("Usuario").fill("ana.supervisora");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
}

async function signIn(page: Page) {
  await fillCredentials(page);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("sign-in", () => {
  test("a deep link goes to sign-in and, after it, back to the target", async ({ page }) => {
    await mockApi(page, { me: null, signInAs: makeMe() });

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fsettings$/);
    await signIn(page);

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { level: 1, name: "Configuración" })).toBeVisible();
  });

  test("an external redirect parameter is ignored: the user lands on Home", async ({ page }) => {
    await mockApi(page, { me: null });

    await page.goto("/login?redirect=//evil.example");
    await signIn(page);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Inicio" })).toBeVisible();
  });

  test("wrong credentials show one generic message and keep what was typed", async ({ page }) => {
    await mockApi(page, { me: null, login: "invalid" });

    await page.goto("/login");
    await signIn(page);

    const alert = page.getByRole("alert");
    await expect(alert).toContainText("El usuario o la contraseña no coinciden.");
    await expect(alert).toBeFocused();
    await expect(page.getByLabel("Usuario")).toHaveValue("ana.supervisora");
  });

  test("a lockout says how long to wait, from Retry-After", async ({ page }) => {
    await mockApi(page, { me: null, login: "locked", retryAfterSeconds: 900 });

    await page.goto("/login");
    await signIn(page);

    await expect(page.getByRole("alert")).toContainText(
      "Demasiados intentos. Espera 15 min e inténtalo de nuevo.",
    );
  });

  test("the CSRF cookie is requested when the page opens, and the token travels as a header", async ({
    page,
  }) => {
    const api = await mockApi(page, { me: null });

    await page.goto("/login");
    await signIn(page);

    await expect(page).toHaveURL(/\/$/);
    const csrf = api.requests.filter((request) => request.path === "/api/v1/auth/csrf/");
    const login = api.requests.find((request) => request.path === "/api/v1/auth/login/");
    expect(csrf.length).toBeGreaterThan(0);
    expect(login?.headers["x-csrftoken"]).toBe("e2e-csrf");
    expect(login?.body).toEqual({ username: "ana.supervisora", password: E2E_PASSWORD });
  });

  test("the whole sign-in works with the keyboard alone", async ({ page }) => {
    await mockApi(page, { me: null });
    await page.goto("/login");

    await page.keyboard.press("Tab"); // language switch
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Usuario")).toBeFocused();
    await page.keyboard.type("ana.supervisora");
    await page.keyboard.press("Tab");
    await page.keyboard.type(E2E_PASSWORD);
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { level: 1, name: "Inicio" })).toBeVisible();
  });

  test("the show-password button toggles the field by keyboard", async ({ page }) => {
    await mockApi(page, { me: null });
    await page.goto("/login");
    await page.getByLabel("Contraseña", { exact: true }).fill("x");

    await page.keyboard.press("Tab"); // the toggle follows the password field
    await page.keyboard.press("Space");

    await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Mostrar contraseña" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("at 320 px the page reflows without horizontal scroll", async ({ page }) => {
    await mockApi(page, { me: null });
    await page.setViewportSize({ width: 320, height: 800 });

    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Inicia sesión" })).toBeVisible();

    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });
});

test.describe("permissions and sign-out", () => {
  test("a deep link to a forbidden area shows no-permission inside the shell", async ({ page }) => {
    await mockApi(page, { me: makeMe({ permissions: [] }) });

    await page.goto("/settings");

    await expect(
      page.getByRole("heading", { level: 1, name: "No tienes acceso a esta sección" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Configuración" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ir al inicio" })).toBeVisible();
  });

  test("the user menu opens, closes with Escape and signs out", async ({ page }) => {
    const api = await mockApi(page);
    await page.goto("/");
    const button = page.getByRole("button", { name: "Ana Pérez Menú de usuario" });

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Supervisora")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();

    await button.click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Inicia sesión" })).toBeVisible();
    expect(api.requests.some((request) => request.path === "/api/v1/auth/logout/")).toBe(true);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fsettings$/);
  });
});

test.describe("password reset", () => {
  test("the request always ends with the same confirmation", async ({ page }) => {
    await mockApi(page, { me: null });
    await page.goto("/login");
    await page.getByRole("link", { name: "Olvidé mi contraseña" }).click();

    await page.getByLabel("Correo electrónico").fill("ana@example.org");
    await page.getByRole("button", { name: "Enviar enlace" }).click();

    await expect(page.getByRole("status")).toContainText("Si ese correo está registrado");
    await expect(page.getByRole("status")).toBeFocused();
  });

  test("the emailed link sets a new password and returns to sign-in with a notice", async ({
    page,
  }) => {
    const api = await mockApi(page, { me: null });

    await page.goto("/reset-password/MQ/set-password-link");
    await expect(page).toHaveURL(/\/reset-password$/); // the token is not left in the address bar
    await page.getByLabel("Contraseña nueva").fill(E2E_PASSWORD);
    await page.getByLabel("Confirma la contraseña").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();

    await expect(page).toHaveURL(/\/login\?notice=password-changed$/);
    await expect(page.getByRole("status")).toContainText("Tu contraseña se actualizó");
    const confirm = api.requests.find((request) => request.path.endsWith("/confirm/"));
    expect(confirm?.body).toEqual({
      uid: "MQ",
      token: "set-password-link",
      new_password: E2E_PASSWORD,
    });
  });

  test("an invalid link explains itself and offers a new one", async ({ page }) => {
    await mockApi(page, { me: null, resetConfirm: "invalid-link" });

    await page.goto("/reset-password/MQ/old-link");
    await page.getByLabel("Contraseña nueva").fill(E2E_PASSWORD);
    await page.getByLabel("Confirma la contraseña").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();

    await expect(page.getByRole("alert")).toContainText("Este enlace ya no sirve");
    await expect(page.getByRole("link", { name: "Pedir un enlace nuevo" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  test("a weak password is explained on its field", async ({ page }) => {
    await mockApi(page, { me: null, resetConfirm: "too-common" });

    await page.goto("/reset-password/MQ/set-password-link");
    await page.getByLabel("Contraseña nueva").fill(E2E_PASSWORD);
    await page.getByLabel("Confirma la contraseña").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();

    await expect(page.getByText("Esa contraseña es muy común. Elige otra.")).toBeVisible();
    await expect(page.getByLabel("Contraseña nueva")).toBeFocused();
  });
});

test.describe("organization selection", () => {
  test("a user with several organizations chooses one before entering, by keyboard", async ({
    page,
  }) => {
    const user = makeMe({ organizations: TWO_ORGANIZATIONS });
    const api = await mockApi(page, { me: null, signInAs: user });
    await page.goto("/login?redirect=%2Fsettings");
    await signIn(page);

    await expect(page).toHaveURL(/\/select-organization\?redirect=%2Fsettings$/);
    await page.getByRole("radio", { name: "Región Norte" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: "Región Sur" })).toBeChecked();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/settings$/);
    const me = api.requests.filter((request) => request.path === "/api/v1/me/").at(-1);
    expect(me?.headers["x-organization"]).toBe("sur");
    for (const request of api.requests) expect(request.path).not.toContain("sur");
    expect(await page.evaluate(() => window.localStorage.getItem("wolbachia.organization"))).toBe(
      "sur",
    );
  });

  test("a user with one organization never sees the chooser", async ({ page }) => {
    await mockApi(page, { me: makeMe() });

    await page.goto("/select-organization");

    await expect(page).toHaveURL(/\/$/);
  });

  test("signing out forgets the chosen organization", async ({ page }) => {
    await mockApi(page, { me: makeMe({ organizations: TWO_ORGANIZATIONS }) });
    await page.addInitScript(() => {
      window.localStorage.setItem("wolbachia.organization", "norte");
    });
    await page.goto("/");

    await page.getByRole("button", { name: /Menú de usuario/ }).click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Inicia sesión" })).toBeVisible();
    expect(
      await page.evaluate(() => window.localStorage.getItem("wolbachia.organization")),
    ).toBeNull();
  });
});
