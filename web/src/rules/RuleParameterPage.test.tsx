import { invalidateRuleParameters } from "./rules-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, test } from "vitest";
import { acceptSession, confirmSignOut } from "../session/session-revision";
import { isSessionExpired } from "../session/session-events";
import { apiError, makeMe } from "../test/fake-api";
import {
  CREATE_ROUTE,
  PARAMETER_ROUTE,
  makeParameter,
  makeVersion,
  openParameterPage,
  pageOf,
  requestsTo,
} from "../test/rules-fixtures";

const PARAMETER_PATH_API = "/api/v1/rule-parameters/max_distance_to_point_m/";
const VERSIONS_PATH_API = `${PARAMETER_PATH_API}versions/`;
const NAME = "Distancia máxima al punto";
const CREATED = makeVersion({ id: "2", status: "scheduled", effective_date: "2026-11-10" });
const REASON = "Ajuste acordado con entomología";

const created = () => Response.json(CREATED, { status: 201 });
const refused = (field: string, code: string, params: Record<string, unknown> = {}) =>
  Response.json(
    { code: "validation_error", detail: "Fake.", fields: { [field]: [{ code, params }] } },
    { status: 400 },
  );

async function fill(user: ReturnType<typeof userEvent.setup>, value: string, date = "2026-11-10") {
  await user.type(await screen.findByLabelText(/Valor nuevo/), value);
  const dateField = screen.getByLabelText(/Vigente desde \(obligatorio\)/);
  await user.type(dateField, date);
  await user.type(screen.getByLabelText(/Motivo del cambio/), REASON);
}

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Guardar versión" }));

describe("rule parameter page: summary", () => {
  test("shows the value in force, since when, the next change and the allowed range", async () => {
    await openParameterPage({
      parameter: makeParameter({ next_change_at: "2026-12-01T06:00:00Z" }),
    });

    expect(await screen.findByRole("heading", { level: 1, name: NAME })).toBeDefined();
    const summary = screen.getByRole("region", { name: "Valor vigente" });
    expect(within(summary).getByText("50 metros")).toBeDefined();
    expect(within(summary).getByText("1 ene 2026")).toBeDefined();
    expect(within(summary).getByText("1 dic 2026")).toBeDefined();
    expect(within(summary).getByText("De 0 a 500")).toBeDefined();
  });

  test("a parameter with no version is shown as not configured", async () => {
    await openParameterPage({
      parameter: makeParameter({ value: null, effective_from: null, version_id: null }),
      versions: [],
    });

    const summary = await screen.findByRole("region", { name: "Valor vigente" });

    expect(within(summary).getByText("Sin configurar")).toBeDefined();
    expect(within(summary).queryByText(/^0/)).toBeNull();
  });

  test("an address that cannot be a key is not found and asks nothing", async () => {
    const { api } = await openParameterPage({ path: "/settings/rule-parameters/Bad-Key" });

    expect(
      await screen.findByRole("heading", { name: "No encontramos esta página" }),
    ).toBeDefined();
    expect(api.requests.some((request) => request.path.includes("Bad-Key"))).toBe(false);
  });

  test("a key the server does not know is not found", async () => {
    await openParameterPage({ routes: { [PARAMETER_ROUTE]: apiError(404, "not_found") } });

    expect(
      await screen.findByRole("heading", { name: "No encontramos esta página" }),
    ).toBeDefined();
  });

  test("a user without rule_parameter.read gets the no-permission state", async () => {
    const { api } = await openParameterPage({ me: makeMe({ permissions: ["catalog.read"] }) });

    expect(
      await screen.findByRole("heading", { name: "No tienes acceso a esta sección" }),
    ).toBeDefined();
    expect(requestsTo(api, "GET", PARAMETER_PATH_API)).toHaveLength(0);
  });
});

describe("rule parameter page: permissions of its parts", () => {
  test("without rule_parameter_version.create there is no form", async () => {
    await openParameterPage({
      me: makeMe({ permissions: ["rule_parameter.read", "rule_parameter_version.read"] }),
    });
    await screen.findByRole("heading", { level: 1, name: NAME });

    expect(screen.queryByRole("heading", { name: "Nueva versión" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Historial de versiones" })).toBeDefined();
  });

  test("without rule_parameter_version.read there is no history and it is not requested", async () => {
    const { api } = await openParameterPage({
      me: makeMe({ permissions: ["rule_parameter.read", "rule_parameter_version.create"] }),
    });
    await screen.findByRole("heading", { name: "Nueva versión" });

    expect(screen.queryByRole("heading", { name: "Historial de versiones" })).toBeNull();
    expect(requestsTo(api, "GET", VERSIONS_PATH_API)).toHaveLength(0);
  });
});

describe("void action needs the reasons catalog", () => {
  test("without catalog.read there is no Void action even with rule_parameter_version.void", async () => {
    await openParameterPage({
      me: makeMe({
        permissions: [
          "rule_parameter.read",
          "rule_parameter_version.read",
          "rule_parameter_version.void",
        ],
      }),
    });
    await screen.findByRole("heading", { name: "Historial de versiones" });

    expect(screen.queryByRole("button", { name: /Anular/ })).toBeNull();
  });
});

describe("new version form: before and after", () => {
  test("shows what applies today against the new value once the value is valid", async () => {
    const user = userEvent.setup();
    await openParameterPage();
    await fill(user, "40");

    const comparison = await screen.findByRole("region", { name: "Antes y después" });

    expect(within(comparison).getByText("50 metros")).toBeDefined();
    expect(within(comparison).getByText("40 metros")).toBeDefined();
    expect(within(comparison).getByText("Desde el 10 nov 2026")).toBeDefined();
    expect(within(comparison).getByText("Desde el 1 ene 2026")).toBeDefined();
  });

  test("does not compare against a value the server would refuse", async () => {
    const user = userEvent.setup();
    await openParameterPage();
    await user.type(await screen.findByLabelText(/Valor nuevo/), "900");

    expect(screen.queryByRole("region", { name: "Antes y después" })).toBeNull();
  });

  test("tells that a change is already scheduled", async () => {
    await openParameterPage({
      parameter: makeParameter({ next_change_at: "2026-12-01T06:00:00Z" }),
    });

    expect(
      await screen.findByText("Ya hay un cambio programado para el 1 dic 2026."),
    ).toBeDefined();
  });
});

describe("new version form: inline validation", () => {
  test("a value outside the limits is refused as soon as the field is left, with the limits", async () => {
    const user = userEvent.setup();
    const { api } = await openParameterPage();
    const field = await screen.findByLabelText(/Valor nuevo/);

    await user.type(field, "900");
    await user.tab();

    expect((await screen.findByText("El valor debe estar entre 0 y 500.")).id).toBe(
      "rule-version-value-error",
    );
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(requestsTo(api, "POST", VERSIONS_PATH_API)).toHaveLength(0);
  });

  test("submitting an empty form marks every field and sends nothing", async () => {
    const user = userEvent.setup();
    const { api } = await openParameterPage();
    await screen.findByLabelText(/Valor nuevo/);

    await save(user);

    expect(await screen.findByText("Escribe el valor nuevo.")).toBeDefined();
    expect(screen.getByText("Elige desde qué fecha aplica.")).toBeDefined();
    expect(screen.getByText("Cuéntanos por qué cambia el valor.")).toBeDefined();
    expect(requestsTo(api, "POST", VERSIONS_PATH_API)).toHaveLength(0);
  });
});

describe("new version form: saving", () => {
  test("sends the value, the day and the reason, then refreshes the page and empties the form", async () => {
    const user = userEvent.setup();
    const { api } = await openParameterPage({ routes: { [CREATE_ROUTE]: created } });
    await fill(user, "40");

    await save(user);

    expect(await screen.findByText("Versión guardada. Ya aparece en el historial.")).toBeDefined();
    expect(requestsTo(api, "POST", VERSIONS_PATH_API)[0]?.body).toEqual({
      value: "40",
      effective_from: "2026-11-10",
      reason: REASON,
    });
    expect(screen.getByLabelText<HTMLInputElement>(/Valor nuevo/).value).toBe("");
    expect(requestsTo(api, "GET", PARAMETER_PATH_API)).toHaveLength(2);
    expect(requestsTo(api, "GET", VERSIONS_PATH_API)).toHaveLength(2);
  });

  test.each([
    {
      code: "out_of_range",
      field: "value",
      params: { min: 1, max: 10 },
      text: "El valor debe estar entre 1 y 10.",
    },
    {
      code: "not_an_integer",
      field: "value",
      params: {},
      text: "Este parámetro solo admite números enteros.",
    },
    {
      code: "effective_from_in_past",
      field: "effective_from",
      params: {},
      text: "La fecha no puede ser anterior a hoy.",
    },
    {
      code: "effective_from_too_far",
      field: "effective_from",
      params: {},
      text: "Esa fecha queda muy lejos.",
    },
    {
      code: "duplicate_effective_date",
      field: "effective_from",
      params: {},
      text: "Ya hay una versión programada para esa fecha.",
    },
  ])("the server's $code is shown under the field", async ({ code, field, params, text }) => {
    const user = userEvent.setup();
    await openParameterPage({ routes: { [CREATE_ROUTE]: () => refused(field, code, params) } });
    await fill(user, "40");

    await save(user);

    expect(await screen.findByText(new RegExp(text))).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText<HTMLTextAreaElement>(/Motivo del cambio/).value).toBe(REASON);
  });

  test("a failure that is not about a field is an alert and keeps what was typed", async () => {
    const user = userEvent.setup();
    await openParameterPage({ routes: { [CREATE_ROUTE]: apiError(500, "server_error") } });
    await fill(user, "40");

    await save(user);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("No pudimos guardar la versión");
    expect(alert.textContent).toContain("Algo falló de nuestro lado");
    expect(screen.getByLabelText<HTMLInputElement>(/Valor nuevo/).value).toBe("40");
  });

  test("a second press while the first is in flight sends one request", async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { api } = await openParameterPage({ routes: { [CREATE_ROUTE]: () => pending } });
    await fill(user, "40");

    await save(user);
    await screen.findByRole("button", { name: "Guardando…" });
    await user.click(screen.getByRole("button", { name: "Guardando…" }));
    release(created());

    await screen.findByText("Versión guardada. Ya aparece en el historial.");
    expect(requestsTo(api, "POST", VERSIONS_PATH_API)).toHaveLength(1);
  });
});

describe("rule parameter page: language and accessibility", () => {
  test("is in English with the same behavior", async () => {
    await openParameterPage({ language: "en" });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Maximum distance to the point" }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "New version" })).toBeDefined();
    expect(screen.getByText("From 0 to 500")).toBeDefined();
  });

  test.each([
    ["es-MX", undefined],
    ["en", "en" as const],
  ])(
    "has no axe violations with the comparison and an error showing, in %s",
    async (_language, language) => {
      const user = userEvent.setup();
      const { app } = await openParameterPage({
        versions: [makeVersion(), makeVersion({ id: "2", status: "scheduled" })],
        ...(language ? { language } : {}),
      });
      await user.type(await screen.findByLabelText(/(Valor nuevo|New value)/), "40");
      await user.tab();
      await user.tab();
      await user.tab();
      await waitFor(() => {
        expect(
          screen.getByRole("region", { name: /Antes y después|Before and after/ }),
        ).toBeDefined();
      });

      expect(await axe(app.container)).toHaveNoViolations();
    },
  );
});

describe("rule parameter page: regressions found in review", () => {
  test("a late answer of a closed session neither expires the new one nor touches the form", async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    await openParameterPage({ routes: { [CREATE_ROUTE]: () => pending } });
    await fill(user, "40");
    await save(user);
    await screen.findByRole("button", { name: "Guardando…" });

    confirmSignOut();
    acceptSession();
    release(apiError(401, "not_authenticated"));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Guardando…" })).toBeNull();
    });
    expect(isSessionExpired()).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>(/Valor nuevo/).value).toBe("40");
  });

  test("a failed background refresh keeps the form and its draft and offers to retry", async () => {
    const user = userEvent.setup();
    const { app, api } = await openParameterPage();
    await user.type(await screen.findByLabelText(/Valor nuevo/), "40");
    api.setRoute(PARAMETER_ROUTE, apiError(500, "server_error"));

    await invalidateRuleParameters(app.queryClient);

    expect(await screen.findByText(/No pudimos actualizar/)).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>(/Valor nuevo/).value).toBe("40");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDefined();
  });

  test("regression: moving to another parameter starts a clean form and ignores a pending answer of the first", async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const speed = makeParameter({ key: "speed_lock_kmh", unit: "km_h", value: 10 });
    const { app } = await openParameterPage({
      routes: {
        [CREATE_ROUTE]: () => pending,
        "GET /api/v1/rule-parameters/speed_lock_kmh/": () => Response.json(speed),
        "GET /api/v1/rule-parameters/speed_lock_kmh/versions/": () => pageOf([makeVersion()]),
      },
    });
    await fill(user, "40");
    await save(user);
    await screen.findByRole("button", { name: "Guardando…" });

    await app.router.navigate({
      to: "/settings/rule-parameters/$key",
      params: { key: "speed_lock_kmh" },
    });
    await screen.findByRole("heading", { level: 1, name: "Velocidad que bloquea la captura" });
    await user.type(screen.getByLabelText(/Valor nuevo/), "7");
    release(created());

    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>(/Valor nuevo/).value).toBe("7");
    });
    expect(screen.queryByText("Versión guardada. Ya aparece en el historial.")).toBeNull();
    expect(screen.getByLabelText<HTMLTextAreaElement>(/Motivo del cambio/).value).toBe("");
  });
});
