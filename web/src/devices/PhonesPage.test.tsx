import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, test } from "vitest";
import { ME_QUERY_KEY } from "../session/me-query";
import { apiError, createFakeApi, makeMe, makeOrganization } from "../test/fake-api";
import type { RecordedRequest } from "../test/fake-api";
import { renderApp } from "../test/render-app";
import type { Phone } from "./phones-query";

const ME = "GET /api/v1/me/";
const DEVICES = "GET /api/v1/devices/";
const PHONES = "/settings/phones";
const ALLOWED = makeMe({ permissions: ["device.read"] });

function phone(overrides: Partial<Phone> = {}): Phone {
  return {
    id: "6b1f0d5e-0a43-4c19-8c0e-3d0f7f0a0001",
    label: "Teléfono de Luis",
    serial: "SN-0001",
    app_version: "1.4.0",
    last_seen_at: "2026-11-04T03:30:00Z",
    last_user: "5f5c4c3e-4a0e-4a64-9a60-1a2b3c4d5e01",
    last_user_username: "luis",
    is_revoked: false,
    revoked_at: null,
    revoked_by: null,
    created_at: "2026-10-01T15:00:00Z",
    ...overrides,
  };
}

function pageOf(results: Phone[], count = results.length): Response {
  return Response.json({ count, next: null, previous: null, results });
}

function queryOf(request: RecordedRequest): URLSearchParams {
  return new URL(request.path, "http://x").searchParams;
}

function open(
  reply: Response | ((request: RecordedRequest) => Response | Promise<Response>),
  path = PHONES,
  me = ALLOWED,
) {
  const api = createFakeApi({ [ME]: Response.json(me), [DEVICES]: reply });
  return renderApp({ path, fetch: api.fetch, me }).then((app) => ({ api, app }));
}

const devicesRequests = (api: { requests: RecordedRequest[] }) =>
  api.requests.filter((request) => request.path.startsWith("/api/v1/devices/"));

describe("phones list (W67)", () => {
  test("shows the phones read from GET /devices/, with the date in the organization's time zone", async () => {
    const { api } = await open(
      pageOf([
        phone(),
        phone({
          id: "2",
          label: "Teléfono de Rosa",
          last_user_username: null,
          last_seen_at: null,
          is_revoked: true,
        }),
      ]),
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Teléfonos" })).toBeDefined();
    const luis = await screen.findByRole("row", { name: /Teléfono de Luis/ });
    expect(within(luis).getByText("luis")).toBeDefined();
    expect(within(luis).getByText("1.4.0")).toBeDefined();
    expect(within(luis).getByText(/3 nov 2026/)).toBeDefined();
    expect(within(luis).getByText("Activo")).toBeDefined();
    const rosa = screen.getByRole("row", { name: /Teléfono de Rosa/ });
    expect(within(rosa).getByText("Sin usuario")).toBeDefined();
    expect(within(rosa).getByText("Nunca")).toBeDefined();
    expect(within(rosa).getByText("Revocado")).toBeDefined();
    const query = queryOf(devicesRequests(api)[0] as RecordedRequest);
    expect(Object.fromEntries(query)).toEqual({ page: "1", page_size: "25" });
  });

  test("is read only: no revoke, upload or version controls", async () => {
    await open(pageOf([phone()]));
    await screen.findByRole("row", { name: /Teléfono de Luis/ });

    expect(screen.queryByRole("button", { name: /revoc|subir|publicar/i })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /Seleccionar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Exportar" })).toBeNull();
  });

  test("a user without device.read gets the no-permission state and no request", async () => {
    const { api } = await open(
      pageOf([phone()]),
      PHONES,
      makeMe({ permissions: ["catalog.read"] }),
    );

    expect(
      await screen.findByRole("heading", { name: "No tienes acceso a esta sección" }),
    ).toBeDefined();
    expect(devicesRequests(api)).toHaveLength(0);
  });

  test("the status filter sends is_revoked and is kept in the URL", async () => {
    const user = userEvent.setup();
    const { api, app } = await open(pageOf([phone()]));
    await screen.findByRole("row", { name: /Teléfono de Luis/ });

    await user.selectOptions(screen.getByRole("combobox", { name: "Estado" }), "Revocado");

    await waitFor(() => {
      expect(app.router.state.location.search).toEqual({ is_revoked: "true" });
    });
    await waitFor(() => {
      expect(devicesRequests(api).map((request) => queryOf(request).get("is_revoked"))).toContain(
        "true",
      );
    });
    expect(screen.getByRole("button", { name: "Quitar filtro Estado: Revocado" })).toBeDefined();
  });

  test("opens straight from a shared address: page and filter come from the URL", async () => {
    const { api } = await open(pageOf([phone()], 60), `${PHONES}?page=2&is_revoked=false`);

    expect(await screen.findByText("Página 2 de 3")).toBeDefined();
    expect(screen.getByRole("button", { name: "Quitar filtro Estado: Activo" })).toBeDefined();
    const query = queryOf(devicesRequests(api)[0] as RecordedRequest);
    expect(Object.fromEntries(query)).toEqual({ page: "2", page_size: "25", is_revoked: "false" });
  });

  test("a parameter the list does not know is never sent and is announced", async () => {
    const { api } = await open(pageOf([phone()]), `${PHONES}?organization_id=abc&sort=version`);

    expect(await screen.findByText(/no se aplicaron: organization_id, sort/)).toBeDefined();
    const query = queryOf(devicesRequests(api)[0] as RecordedRequest);
    expect(Object.fromEntries(query)).toEqual({ page: "1", page_size: "25" });
  });

  test("shows the first-load state, then the rows, without a timer", async () => {
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    await open(() => pending);

    expect(await screen.findByText("Cargando resultados")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
    release(pageOf([phone()]));

    expect(await screen.findByRole("row", { name: /Teléfono de Luis/ })).toBeDefined();
  });

  test("an empty organization says there are no phones yet", async () => {
    await open(pageOf([]));

    expect(await screen.findByText("Aquí todavía no hay registros")).toBeDefined();
  });

  test("a failure is an alert and Retry asks again", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { api } = await open(() => {
      attempts += 1;
      return attempts === 1 ? apiError(500, "server_error") : pageOf([phone()]);
    });

    expect((await screen.findByRole("alert")).textContent).toContain("Algo falló de nuestro lado");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("row", { name: /Teléfono de Luis/ })).toBeDefined();
    expect(devicesRequests(api)).toHaveLength(2);
  });

  test("after an identity change the new organization's pending request never shows the old rows (#82)", async () => {
    const { api, app } = await open(pageOf([phone({ label: "Teléfono de Norte" })]));
    await screen.findByRole("row", { name: /Teléfono de Norte/ });
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    api.setRoute(ME, Response.json({ ...ALLOWED, organization: makeOrganization("sur", "Sur") }));
    api.setRoute(DEVICES, () => pending);

    await app.queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });

    expect(await screen.findByText("Cargando resultados")).toBeDefined();
    expect(screen.queryByText("Teléfono de Norte")).toBeNull();
    release(pageOf([phone({ label: "Teléfono de Sur" })]));
    expect(await screen.findByRole("row", { name: /Teléfono de Sur/ })).toBeDefined();
  });

  test("is in English when the language is English", async () => {
    const api = createFakeApi({ [ME]: Response.json(ALLOWED), [DEVICES]: pageOf([phone()]) });
    await renderApp({ path: PHONES, fetch: api.fetch, language: "en" });

    expect(await screen.findByRole("heading", { level: 1, name: "Phones" })).toBeDefined();
    expect(await screen.findByRole("columnheader", { name: "Last seen" })).toBeDefined();
    expect(await screen.findByText(/Nov 3, 2026/)).toBeDefined();
  });

  test("has no axe violations", async () => {
    const { app } = await open(
      pageOf([phone(), phone({ id: "2", label: "Teléfono de Rosa", is_revoked: true })]),
    );
    await screen.findByRole("row", { name: /Teléfono de Luis/ });

    expect(await axe(app.container)).toHaveNoViolations();
  });
});

describe("settings home links", () => {
  test("links to the phones list when the user may read devices", async () => {
    await open(pageOf([]), "/settings");

    const link = await screen.findByRole("link", { name: "Teléfonos" });

    expect(link.getAttribute("href")).toBe(PHONES);
  });

  test("hides the link from a user who may not", async () => {
    await open(pageOf([]), "/settings", makeMe({ permissions: ["catalog.read"] }));
    await screen.findByRole("heading", { level: 1, name: "Configuración" });

    expect(screen.queryByRole("link", { name: "Teléfonos" })).toBeNull();
  });
});
