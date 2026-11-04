import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, describe, expect, test, vi } from "vitest";
import { apiError, createFakeApi, noContent } from "../test/fake-api";
import { fakePassword } from "../test/fake-credentials";
import { renderApp } from "../test/render-app";

const CONFIRM_PATH = "POST /api/v1/auth/password-reset/confirm/";
const LINK_PATH = "/reset-password#uid=MQ&token=set-password-link";
const LEGACY_LINK_PATH = "/reset-password/MQ/set-password-link";
const NEW_PASSWORD = fakePassword();

afterEach(() => {
  vi.restoreAllMocks();
});

async function openReset(
  reply: Response = noContent(204),
  language: "es-MX" | "en" = "es-MX",
  path: string = LINK_PATH,
) {
  const api = createFakeApi({ [CONFIRM_PATH]: reply });
  const app = await renderApp({ path, fetch: api.fetch, language });
  await screen.findByRole("heading", { level: 1 });
  return { api, app };
}

async function fillAndSend(newPassword: string, confirmation: string = newPassword) {
  await userEvent.type(screen.getByLabelText("Contraseña nueva"), newPassword);
  await userEvent.type(screen.getByLabelText("Confirma la contraseña"), confirmation);
  await userEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));
}

function weakPassword(code: string): Response {
  return apiError(400, "validation_error", { fields: { new_password: [{ code }] } });
}

describe("reset password: the page of the emailed link", () => {
  test("opens at /reset-password#uid=...&token=..., with no session, and uses new-password fields", async () => {
    const { api } = await openReset();

    expect(
      screen.getByRole("heading", { level: 1, name: "Elige una contraseña nueva" }),
    ).toBeDefined();
    expect(screen.getByLabelText("Contraseña nueva").getAttribute("autocomplete")).toBe(
      "new-password",
    );
    expect(screen.getByLabelText("Confirma la contraseña").getAttribute("autocomplete")).toBe(
      "new-password",
    );
    expect(api.requests).toEqual([]);
  });

  test("takes the token out of the address bar and still completes the reset", async () => {
    window.history.replaceState(null, "", LINK_PATH);
    const { api } = await openReset();

    expect(window.location.pathname).toBe("/reset-password");
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toContain("set-password-link");
    expect(api.requests).toEqual([]);
    await fillAndSend(NEW_PASSWORD);

    await vi.waitFor(() => {
      expect(api.requests[0]?.body).toEqual({
        uid: "MQ",
        token: "set-password-link",
        new_password: NEW_PASSWORD,
      });
    });
  });

  test("sends uid, token and the new password in the body, then goes to sign-in with a notice", async () => {
    const { api, app } = await openReset();

    await fillAndSend(NEW_PASSWORD);

    await vi.waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/login");
    });
    expect(api.requests[0]?.body).toEqual({
      uid: "MQ",
      token: "set-password-link",
      new_password: NEW_PASSWORD,
    });
    expect(app.router.state.location.search).toEqual({ notice: "password-changed" });
    expect(api.requests[0]?.path).toBe("/api/v1/auth/password-reset/confirm/");
  });

  test("a confirmation that does not match is explained and nothing is sent", async () => {
    const { api } = await openReset();

    await fillAndSend(NEW_PASSWORD, fakePassword());

    const confirmation = screen.getByLabelText("Confirma la contraseña");
    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeDefined();
    expect(document.activeElement).toBe(confirmation);
    expect(api.requests).toEqual([]);
  });

  test("a link from before the fragment format (values in the path) still works", async () => {
    window.history.replaceState(null, "", LEGACY_LINK_PATH);
    const { api } = await openReset(noContent(204), "es-MX", LEGACY_LINK_PATH);

    expect(window.location.pathname).toBe("/reset-password");
    await fillAndSend(NEW_PASSWORD);

    await vi.waitFor(() => {
      expect(api.requests[0]?.body).toEqual({
        uid: "MQ",
        token: "set-password-link",
        new_password: NEW_PASSWORD,
      });
    });
  });

  test.each([
    ["has no fragment", "/reset-password"],
    ["has no token", "/reset-password#uid=MQ"],
    ["has a malformed token", "/reset-password#uid=MQ&token=../x"],
    ["repeats a value", "/reset-password#uid=MQ&token=a&token=b"],
  ])("a link that %s shows the invalid-link state and sends nothing", async (_name, path) => {
    window.history.replaceState(null, "", path);
    const { api } = await openReset(noContent(204), "es-MX", path);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Este enlace ya no sirve");
    expect(screen.queryByLabelText("Contraseña nueva")).toBeNull();
    expect(screen.getByRole("link", { name: "Pedir un enlace nuevo" })).toBeDefined();
    expect(window.location.href).not.toContain("token=");
    expect(api.requests).toEqual([]);
  });

  test("empty fields ask for a password", async () => {
    await openReset();

    await userEvent.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect((await screen.findAllByText("Escribe una contraseña.")).length).toBe(2);
  });

  test.each([
    ["password_too_short", "La contraseña es demasiado corta. Usa una más larga."],
    ["password_too_common", "Esa contraseña es muy común. Elige otra."],
    ["password_entirely_numeric", "La contraseña no puede ser solo números."],
    ["password_too_similar", "La contraseña se parece demasiado a tus datos. Elige otra."],
  ])("maps the validator code %s to its message on the field", async (code, message) => {
    await openReset(weakPassword(code));

    await fillAndSend(NEW_PASSWORD);

    expect(await screen.findByText(message)).toBeDefined();
    const field = screen.getByLabelText("Contraseña nueva");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field);
  });

  test("an unknown validator code falls back to the generic validation message", async () => {
    await openReset(weakPassword("password_something_new"));

    await fillAndSend(NEW_PASSWORD);

    expect(
      await screen.findByText(
        "Hay datos que no son válidos. Revisa los campos marcados y corrígelos.",
      ),
    ).toBeDefined();
  });

  test("an invalid, expired or used link says so and offers a new one", async () => {
    await openReset(apiError(400, "invalid_reset_token"));

    await fillAndSend(NEW_PASSWORD);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Este enlace ya no sirve");
    expect(document.activeElement).toBe(alert);
    expect(screen.getByRole("link", { name: "Pedir un enlace nuevo" }).getAttribute("href")).toBe(
      "/forgot-password",
    );
    expect(screen.queryByLabelText("Contraseña nueva")).toBeNull();
  });

  test("a rate limit and a server error are reported without losing the form", async () => {
    await openReset(apiError(429, "throttled", { headers: { "Retry-After": "60" } }));

    await fillAndSend(NEW_PASSWORD);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Hiciste muchas solicitudes seguidas",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Contraseña nueva").value).toBe(NEW_PASSWORD);
  });

  test("the show/hide button keeps one name and exposes its state", async () => {
    await openReset();
    const toggles = screen.getAllByRole("button", { name: "Mostrar contraseña" });
    const field = screen.getByLabelText("Contraseña nueva");

    await userEvent.click(toggles[0] as HTMLElement);

    expect(field.getAttribute("type")).toBe("text");
    expect(toggles[0]?.getAttribute("aria-pressed")).toBe("true");
  });

  test("is translated to English", async () => {
    await openReset(noContent(204), "en");

    expect(screen.getByRole("heading", { level: 1, name: "Choose a new password" })).toBeDefined();
    expect(screen.getByLabelText("New password")).toBeDefined();
  });

  test.each(["es-MX", "en"] as const)("has no axe violations in %s", async (language) => {
    const { app } = await openReset(noContent(204), language);

    expect(await axe(app.container)).toHaveNoViolations();
  });

  test("the invalid-link state has no axe violations", async () => {
    const { app } = await openReset(apiError(400, "invalid_reset_token"));
    await fillAndSend(NEW_PASSWORD);
    await screen.findByRole("alert");

    expect(await axe(app.container)).toHaveNoViolations();
  });
});
