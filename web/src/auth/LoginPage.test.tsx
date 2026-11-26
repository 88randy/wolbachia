import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  clearOrganizationSlug,
  getOrganizationSlug,
  setOrganizationSlug,
} from "../session/organization-slug";
import { apiError, createFakeApi, makeMe, noContent } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { fakePassword } from "../test/fake-credentials";
import { renderApp } from "../test/render-app";

const LOGIN = "POST /api/v1/auth/login/";
const CSRF = "GET /api/v1/auth/csrf/";
const ME = "GET /api/v1/me/";
const PASSWORD = fakePassword();

function csrfReply() {
  return () => {
    document.cookie = "csrftoken=test-csrf; path=/";
    return noContent(204);
  };
}

function loginReply(me = makeMe()) {
  return Response.json({ me, server_time: "2026-11-04T12:00:00Z" });
}

function openLogin(routes: FakeApiRoutes = {}, path = "/login") {
  const api = createFakeApi({
    [CSRF]: csrfReply(),
    [LOGIN]: loginReply(),
    [ME]: Response.json(makeMe()),
    ...routes,
  });
  return renderApp({ path, fetch: api.fetch, me: null }).then((app) => ({ api, app }));
}

async function signIn(username = "ana.supervisora", password = PASSWORD) {
  await userEvent.type(await screen.findByLabelText("Usuario"), username);
  await userEvent.type(screen.getByLabelText("Contraseña"), password);
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

function expiredCookie() {
  document.cookie = "csrftoken=; Max-Age=0; path=/";
}

beforeEach(() => {
  clearOrganizationSlug();
  window.localStorage.clear();
  expiredCookie();
});

afterEach(() => {
  vi.restoreAllMocks();
  expiredCookie();
});

describe("W1 sign-in: the screen", () => {
  test("has the fields, the forgot link, the no-sign-up note and no way to create an account", async () => {
    await openLogin();

    expect(await screen.findByRole("heading", { level: 1, name: "Inicia sesión" })).toBeDefined();
    expect(screen.getByLabelText("Usuario").getAttribute("autocomplete")).toBe("username");
    expect(screen.getByLabelText("Contraseña").getAttribute("autocomplete")).toBe(
      "current-password",
    );
    expect(screen.getByRole("link", { name: "Olvidé mi contraseña" }).getAttribute("href")).toBe(
      "/forgot-password",
    );
    expect(
      screen.getByText("Las cuentas las da de alta el administrador de tu organización."),
    ).toBeDefined();
    expect(screen.queryByText(/crear cuenta|regístrate|sign up/i)).toBeNull();
    expect(document.title).toBe("Inicia sesión · AedesVision");
  });

  test("the password toggle shows and hides it with aria-pressed", async () => {
    await openLogin();
    const toggle = await screen.findByRole("button", { name: "Mostrar contraseña" });

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(toggle);

    expect(screen.getByLabelText("Contraseña").getAttribute("type")).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  test("switches language without leaving the page", async () => {
    await openLogin();

    await userEvent.click(
      await screen.findByRole("button", { name: "ES: cambiar idioma a inglés" }),
    );

    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeDefined();
    expect(screen.getByLabelText("Username")).toBeDefined();
  });

  test("empty fields are explained, focus goes to the first one and nothing is sent", async () => {
    const { api } = await openLogin();
    await userEvent.click(await screen.findByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Escribe tu usuario.")).toBeDefined();
    expect(screen.getByText("Escribe tu contraseña.")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText("Usuario"));
    expect(api.requests.filter((request) => request.method === "POST")).toEqual([]);
  });
});

describe("W1 sign-in: CSRF bootstrap", () => {
  test("asks for the CSRF cookie when the page opens", async () => {
    const { api } = await openLogin();
    await screen.findByRole("heading", { level: 1 });

    await vi.waitFor(() => {
      expect(api.requests.map((request) => `${request.method} ${request.path}`)).toContain(
        "GET /api/v1/auth/csrf/",
      );
    });
  });

  test("does not ask again when the cookie is already there", async () => {
    document.cookie = "csrftoken=already-here; path=/";
    const { api } = await openLogin();
    await screen.findByRole("heading", { level: 1 });

    expect(api.requests).toEqual([]);
  });

  test("sends the token as X-CSRFToken and the credentials only in the body", async () => {
    const { api } = await openLogin();

    await signIn("  ana.supervisora ");

    await vi.waitFor(() => {
      expect(api.requests.some((request) => request.method === "POST")).toBe(true);
    });
    const post = api.requests.find((request) => request.method === "POST");
    expect(post?.headers.get("X-CSRFToken")).toBe("test-csrf");
    expect(post?.body).toEqual({ username: "ana.supervisora", password: PASSWORD });
    expect(post?.path).toBe("/api/v1/auth/login/");
  });

  test("a CSRF rejection refreshes the token and retries once", async () => {
    let attempts = 0;
    const { api } = await openLogin({
      [LOGIN]: () => {
        attempts += 1;
        return attempts === 1 ? apiError(403, "permission_denied") : loginReply();
      },
    });

    await signIn();

    await vi.waitFor(() => {
      expect(attempts).toBe(2);
    });
    expect(
      api.requests.filter((request) => request.method === "GET" && request.path.includes("csrf"))
        .length,
    ).toBeGreaterThanOrEqual(2);
  });

  test("a second CSRF rejection shows the generic error and stops", async () => {
    let attempts = 0;
    await openLogin({
      [LOGIN]: () => {
        attempts += 1;
        return apiError(403, "permission_denied");
      },
    });

    await signIn();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No pudimos completar la acción",
    );
    expect(attempts).toBe(2);
  });
});

describe("W1 sign-in: after signing in", () => {
  test("goes to the originally requested route and does not ask /me/ again", async () => {
    const { api, app } = await openLogin({}, "/login?redirect=%2Fsettings%3Ftab%3D1");

    await signIn();

    await vi.waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/settings");
    });
    expect(app.router.state.location.searchStr).toBe("?tab=1");
    expect(api.requests.filter((request) => request.path === "/api/v1/me/")).toEqual([]);
    expect(await screen.findByRole("heading", { level: 1, name: "Configuración" })).toBeDefined();
  });

  test.each([
    ["//evil.example", "protocol-relative"],
    ["https://evil.example/x", "absolute"],
    ["javascript:alert(1)", "javascript scheme"],
    ["/\\evil.example", "backslash"],
  ])("rejects an external redirect (%s, %s) and goes Home", async (target) => {
    const { app } = await openLogin({}, `/login?redirect=${encodeURIComponent(target)}`);

    await signIn();

    await vi.waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/");
    });
    expect(await screen.findByRole("heading", { level: 1, name: /^Hola,/ })).toBeDefined();
  });

  test("a user with several organizations chooses one first, keeping the target", async () => {
    const chooser = makeMe({
      organization: null,
      profiles: [],
      permissions: [],
      organizations: [
        { slug: "norte", name: "Región Norte" },
        { slug: "sur", name: "Región Sur" },
      ],
    });
    const { app } = await openLogin(
      { [LOGIN]: loginReply(chooser) },
      "/login?redirect=%2Fsettings",
    );

    await signIn();

    await vi.waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/select-organization");
    });
    expect(app.router.state.location.search).toEqual({ redirect: "/settings" });
  });

  test("a user with one organization never sees the chooser", async () => {
    const { app } = await openLogin();

    await signIn();

    await vi.waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/");
    });
  });

  test("a stored slug of someone else is dropped and the login retried without it", async () => {
    let headers: (string | null)[] = [];
    await openLogin({
      [LOGIN]: (request) => {
        headers = [...headers, request.headers.get("X-Organization")];
        return request.headers.has("X-Organization")
          ? apiError(403, "no_active_membership")
          : loginReply();
      },
    });

    // Set after the page opened (another tab, say): the page itself forgets slugs left behind.
    setOrganizationSlug("gone");
    await signIn();

    await vi.waitFor(() => {
      expect(headers).toEqual(["gone", null]);
    });
    expect(getOrganizationSlug()).toBeUndefined();
  });
});

describe("W1 sign-in: failures", () => {
  test("an unknown user and a wrong password get exactly the same message", async () => {
    await openLogin({ [LOGIN]: apiError(401, "invalid_credentials") });
    await signIn("nobody", PASSWORD);
    const unknown = (await screen.findByRole("alert")).textContent;

    expect(unknown).toContain("El usuario o la contraseña no coinciden.");
    const secondRun = await screen.findByRole("alert");
    expect(secondRun.textContent).toBe(unknown);
  });

  test("the same text comes out whatever detail the server logs", async () => {
    const answerFor = (detail: string) =>
      Response.json({ code: "invalid_credentials", detail }, { status: 401 });
    const texts: string[] = [];
    for (const detail of ["No such user.", "Wrong password.", "Inactive account."]) {
      const { app } = await openLogin({ [LOGIN]: answerFor(detail) });
      await signIn();
      texts.push((await screen.findByRole("alert")).textContent);
      app.unmount();
    }

    expect(new Set(texts).size).toBe(1);
  });

  test("never shows remaining attempts or a fixed lock time", async () => {
    await openLogin({ [LOGIN]: apiError(401, "invalid_credentials") });

    await signIn();

    const text = (await screen.findByRole("alert")).textContent;
    expect(text).not.toMatch(/intento|\b30\b|15 min/i);
  });

  test("marks both fields and moves focus to the summary", async () => {
    await openLogin({ [LOGIN]: apiError(401, "invalid_credentials") });

    await signIn();

    const alert = await screen.findByRole("alert");
    expect(document.activeElement).toBe(alert);
    expect(screen.getByLabelText("Usuario").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Contraseña").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Usuario").getAttribute("aria-describedby")).toBe("login-alert");
  });

  test("keeps what was typed", async () => {
    await openLogin({ [LOGIN]: apiError(401, "invalid_credentials") });

    await signIn("ana.supervisora");

    await screen.findByRole("alert");
    expect(screen.getByLabelText<HTMLInputElement>("Usuario").value).toBe("ana.supervisora");
  });

  test("a lockout says how long to wait, from Retry-After", async () => {
    await openLogin({ [LOGIN]: apiError(429, "throttled", { headers: { "Retry-After": "900" } }) });

    await signIn();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Demasiados intentos. Espera 15 min e inténtalo de nuevo.");
    expect(alert.textContent).toContain("restablecerla");
  });

  test("a lockout in English", async () => {
    await openLogin({ [LOGIN]: apiError(429, "throttled", { headers: { "Retry-After": "61" } }) });
    await userEvent.click(
      await screen.findByRole("button", { name: "ES: cambiar idioma a inglés" }),
    );

    await userEvent.type(screen.getByLabelText("Username"), "ana");
    await userEvent.type(screen.getByLabelText("Password"), PASSWORD);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Too many attempts. Wait 2 min and try again.",
    );
  });

  test("a lockout without a usable Retry-After does not invent a number", async () => {
    await openLogin({ [LOGIN]: apiError(429, "throttled") });

    await signIn();

    const text = (await screen.findByRole("alert")).textContent;
    expect(text).toContain("Demasiados intentos. Espera unos minutos");
    expect(text).not.toMatch(/\d/);
  });

  test("an account with no active membership is told to contact the administrator", async () => {
    await openLogin({ [LOGIN]: apiError(403, "no_active_membership") });

    await signIn();

    expect((await screen.findByRole("alert")).textContent).toContain("Contacta a tu administrador");
  });

  test("a network failure is reported and the form keeps its values", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await openLogin({
      [LOGIN]: () => {
        throw new TypeError("Failed to fetch");
      },
    });

    await signIn("ana.supervisora");

    expect((await screen.findByRole("alert")).textContent).toContain(
      "No hay conexión. Revisa tu señal e inténtalo de nuevo.",
    );
    expect(screen.getByLabelText<HTMLInputElement>("Usuario").value).toBe("ana.supervisora");
    expect(screen.getByLabelText<HTMLInputElement>("Contraseña").value).toBe(PASSWORD);
  });

  test("a server error is reported", async () => {
    await openLogin({ [LOGIN]: apiError(503, "server_error") });

    await signIn();

    expect((await screen.findByRole("alert")).textContent).toContain("Algo falló de nuestro lado");
  });

  test("pressing the button twice sends one request", async () => {
    let attempts = 0;
    let release: (response: Response) => void = () => undefined;
    const answer = new Promise<Response>((resolve) => {
      release = resolve;
    });
    await openLogin({
      [LOGIN]: () => {
        attempts += 1;
        return answer;
      },
    });
    await userEvent.type(await screen.findByLabelText("Usuario"), "ana");
    await userEvent.type(screen.getByLabelText("Contraseña"), PASSWORD);

    const button = screen.getByRole("button", { name: "Entrar" });
    await userEvent.dblClick(button);
    release(apiError(401, "invalid_credentials"));

    await screen.findByRole("alert");
    expect(attempts).toBe(1);
  });
});

describe("W1 sign-in: a leftover organization", () => {
  test("with nobody signed in, a slug left by a previous session is forgotten", async () => {
    setOrganizationSlug("norte");

    await openLogin();
    await screen.findByRole("heading", { level: 1, name: "Inicia sesión" });

    await vi.waitFor(() => {
      expect(getOrganizationSlug()).toBeUndefined();
    });
  });
});

describe("W1 sign-in: notices from the URL", () => {
  test("after a password reset it says so", async () => {
    await openLogin({}, "/login?notice=password-changed");

    expect((await screen.findByRole("status")).textContent).toContain("Tu contraseña se actualizó");
  });

  test("an account with no access says so", async () => {
    await openLogin({}, "/login?notice=no-membership");

    expect((await screen.findByRole("alert")).textContent).toContain("no tiene acceso activo");
  });

  test("an unknown notice is ignored", async () => {
    await openLogin({}, "/login?notice=%3Cb%3Ehi%3C%2Fb%3E");
    await screen.findByRole("heading", { level: 1 });

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("W1 sign-in: accessibility", () => {
  test.each(["es-MX", "en"] as const)("has no axe violations in %s", async (language) => {
    const api = createFakeApi({ [CSRF]: csrfReply() });
    const { container } = await renderApp({ path: "/login", fetch: api.fetch, me: null, language });
    await screen.findByRole("heading", { level: 1 });

    expect(await axe(container)).toHaveNoViolations();
  });

  test("the error state has no axe violations", async () => {
    const { app } = await openLogin({
      [LOGIN]: apiError(429, "throttled", { headers: { "Retry-After": "900" } }),
    });
    await signIn();
    await screen.findByRole("alert");

    expect(await axe(app.container)).toHaveNoViolations();
  });

  test("the whole flow works by keyboard", async () => {
    const { app } = await openLogin();

    await screen.findByLabelText("Usuario");
    await userEvent.tab(); // the language switch comes first, as it reads in the card header
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /cambiar idioma/ }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Usuario"));
    await userEvent.keyboard("ana.supervisora");
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Contraseña"));
    await userEvent.keyboard(PASSWORD);
    await userEvent.keyboard("{Enter}");

    await vi.waitFor(() => {
      expect(app.router.state.location.pathname).toBe("/");
    });
  });
});
