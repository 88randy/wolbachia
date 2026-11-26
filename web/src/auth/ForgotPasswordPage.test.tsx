import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, describe, expect, test, vi } from "vitest";
import { apiError, createFakeApi, noContent } from "../test/fake-api";
import { renderApp } from "../test/render-app";

const RESET_PATH = "POST /api/v1/auth/password-reset/";
const SENT_TEXT =
  "Si ese correo está registrado, te enviamos un enlace para restablecer tu contraseña. Puede tardar unos minutos; revisa también la carpeta de spam.";

afterEach(() => {
  vi.restoreAllMocks();
});

async function openForgot(api = createFakeApi({ [RESET_PATH]: noContent(202) })) {
  const app = await renderApp({ path: "/forgot-password", fetch: api.fetch });
  return { api, app };
}

async function sendEmail(email: string) {
  await userEvent.type(await screen.findByLabelText("Correo electrónico"), email);
  await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
}

describe("forgot password", () => {
  test("is public: it opens with no session and makes no /me/ request", async () => {
    const { api } = await openForgot();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Restablece tu contraseña" }),
    ).toBeDefined();
    expect(api.requests).toEqual([]);
    expect(document.title).toBe("Restablece tu contraseña · AedesVision");
  });

  test("sends the email in the body and confirms", async () => {
    const { api } = await openForgot();

    await sendEmail("ana@example.org");

    expect(await screen.findByText(SENT_TEXT)).toBeDefined();
    expect(api.requests).toHaveLength(1);
    expect(api.requests[0]?.body).toEqual({ email: "ana@example.org" });
  });

  test("shows the very same confirmation for any address (the API always answers 202)", async () => {
    await openForgot();
    await sendEmail("known@example.org");
    const known = (await screen.findByRole("status")).textContent;
    cleanup();

    await openForgot();
    await sendEmail("nobody-here@example.org");
    const unknown = (await screen.findByRole("status")).textContent;

    expect(unknown).toBe(known);
  });

  test("moves focus to the confirmation", async () => {
    await openForgot();

    await sendEmail("ana@example.org");

    expect(document.activeElement).toBe(await screen.findByRole("status"));
  });

  test("an invalid email is explained, nothing is sent and focus goes to the field", async () => {
    const { api } = await openForgot();

    await sendEmail("not-an-email");

    const field = screen.getByLabelText("Correo electrónico");
    expect(
      await screen.findByText("Escribe un correo válido, por ejemplo nombre@empresa.com."),
    ).toBeDefined();
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field);
    expect(api.requests).toEqual([]);
  });

  test("the rate limit is announced in an alert that takes focus", async () => {
    const api = createFakeApi({
      [RESET_PATH]: apiError(429, "throttled", { headers: { "Retry-After": "3600" } }),
    });
    await openForgot(api);

    await sendEmail("ana@example.org");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Hiciste muchas solicitudes seguidas");
    expect(document.activeElement).toBe(alert);
  });

  test("a network failure keeps the typed email and says so", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const api = createFakeApi({
      [RESET_PATH]: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await openForgot(api);

    await sendEmail("ana@example.org");

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No hay conexión. Revisa tu señal e inténtalo de nuevo.",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Correo electrónico").value).toBe(
      "ana@example.org",
    );
  });

  test("a server error is reported", async () => {
    const api = createFakeApi({ [RESET_PATH]: apiError(500, "server_error") });
    await openForgot(api);

    await sendEmail("ana@example.org");

    expect((await screen.findByRole("alert")).textContent).toContain("Algo falló de nuestro lado");
  });

  test("offers the way back to sign-in", async () => {
    await openForgot();

    const link = await screen.findByRole("link", { name: "Volver a iniciar sesión" });

    expect(link.getAttribute("href")).toBe("/login");
  });

  test.each(["es-MX", "en"] as const)("has no axe violations in %s", async (language) => {
    const { container } = await renderApp({
      path: "/forgot-password",
      language,
      fetch: createFakeApi().fetch,
    });
    await screen.findByRole("heading", { level: 1 });

    expect(await axe(container)).toHaveNoViolations();
  });

  test("the sent state has no axe violations", async () => {
    const { app } = await openForgot();
    await sendEmail("ana@example.org");
    await screen.findByText(SENT_TEXT);

    expect(await axe(app.container)).toHaveNoViolations();
  });
});
