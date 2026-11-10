import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, test } from "vitest";
import { createFakeApi, makeMe } from "../../test/fake-api";
import type { RecordedRequest } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import type { Permit, PermitType } from "./permits-query";

const ME = "GET /api/v1/me/";
const TYPES = "/api/v1/permit-types/";
const PERMITS = "/api/v1/permits/";
const ID = "6b1f0d5e-0a43-4c19-8c0e-3d0f7f0a0001";
const WHOLE = { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } } as const;
const MANAGER = makeMe({ permissions: ["permit.manage", "permit.suspend"], scope: WHOLE });

const POLYGON = {
  type: "Polygon",
  coordinates: [
    [
      [-99.1, 19.4],
      [-99.0, 19.4],
      [-99.0, 19.5],
      [-99.1, 19.4],
    ],
  ],
};

function type(): PermitType {
  return {
    id: "t1",
    code: "STATE",
    name: "Convenio estatal",
    requirements: { max_gps_accuracy_m: 25 },
    created_by: null,
    created_at: "2026-11-01T12:00:00Z",
  };
}

function permit(overrides: Partial<Permit> = {}): Permit {
  return {
    id: ID,
    code: "P-014",
    center: "c1",
    center_code: "C-07",
    quadrant: "q1",
    quadrant_code: "Q-08",
    type_name: "Convenio estatal",
    revision: 1,
    current_version: {
      id: "v1",
      permit: ID,
      revision: 1,
      type: "t1",
      requirements: { max_gps_accuracy_m: 25 },
      number: "014/2026",
      authority: "Secretaría de Salud",
      official_document: "d1",
      document_attestation: "Verificado en ventanilla",
      geometry: POLYGON,
      valid_from: "2026-01-01T06:00:00Z",
      valid_to: "2027-12-31T06:00:00Z",
      created_by: null,
      created_at: "2026-01-01T06:00:00Z",
    },
    suspension: null,
    blocked_by: [],
    created_by: null,
    created_at: "2026-01-01T06:00:00Z",
    ...overrides,
  };
}

const SUSPENDED = permit({
  revision: 2,
  suspension: {
    id: "s1",
    permit: ID,
    revision: 2,
    reason: "La autoridad pidió pausar el permiso",
    effective_from: "2026-11-10T16:00:00Z",
    notices: [{ kind: "courier", status: "delivery_unavailable", count: 2 }],
    created_by: null,
    created_at: "2026-11-10T16:00:00Z",
  },
  blocked_by: [{ reason: "permit_suspended", unblocked_by_role: "admin", link: "" }],
});

const page = (results: object[]) =>
  Response.json({ count: results.length, next: null, previous: null, results });

function open(path: string, routes: Record<string, Response>, me = MANAGER) {
  const api = createFakeApi({ [ME]: Response.json(me), ...routes });
  return renderApp({ path, fetch: api.fetch, me }).then((app) => ({ api, app }));
}

const posts = (api: { requests: RecordedRequest[] }) =>
  api.requests.filter((request) => request.method === "POST");

describe("W43 permit types", () => {
  test("first use explains what a type is for and creates it with its GPS requirement", async () => {
    const { api } = await open("/releases/permit-types", { [`GET ${TYPES}`]: page([]) });
    expect(await screen.findByText(/precisión GPS máxima con la que se acepta/)).toBeDefined();
    api.setRoute(`POST ${TYPES}`, Response.json(type(), { status: 201 }));
    await userEvent.click(screen.getByRole("button", { name: "Crear el primer tipo" }));
    await userEvent.type(screen.getByLabelText("Código"), "STATE");
    await userEvent.type(screen.getByLabelText("Nombre"), "Convenio estatal");
    await userEvent.type(screen.getByLabelText(/Precisión GPS máxima \(metros\)/), "25");
    await userEvent.click(screen.getByRole("button", { name: "Crear tipo" }));
    await waitFor(() => {
      expect(posts(api)[0]?.body).toEqual({
        code: "STATE",
        name: "Convenio estatal",
        requirements: { max_gps_accuracy_m: 25 },
      });
    });
  });

  test("a type without whole-organization scope is disabled with the reason on screen", async () => {
    const me = makeMe({
      permissions: ["permit.manage"],
      scope: { ...WHOLE, centers: { mode: "selected", ids: ["c1"] } },
    });
    await open("/releases/permit-types", { [`GET ${TYPES}`]: page([type()]) }, me);
    expect(await screen.findByText("Convenio estatal")).toBeDefined();
    expect(screen.getByText("Precisión GPS máxima: 25 m")).toBeDefined();
    expect(screen.getByRole("button", { name: "Nuevo tipo de permiso" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByText(/alcance sobre toda la organización/)).toBeDefined();
  });
});

describe("W44 permits and W45 record", () => {
  test("the list states status, zone, validity and which condition blocks", async () => {
    await open("/releases/permits", {
      [`GET ${PERMITS}`]: page([
        permit(),
        { ...SUSPENDED, code: "P-020" },
        permit({
          id: "p3",
          code: "P-099",
          blocked_by: [{ reason: "permit_expired", unblocked_by_role: "admin", link: "" }],
        }),
      ]),
    });
    const valid = await screen.findByRole("row", { name: /P-014/ });
    expect(within(valid).getByText("Vigente")).toBeDefined();
    expect(within(valid).getByText("C-07 · Q-08")).toBeDefined();
    const suspended = screen
      .getAllByRole("row")
      .find((row) => row.textContent.includes("Suspendido"));
    expect(suspended?.textContent).toContain("El permiso está suspendido.");
    expect(screen.getByText("Vencido")).toBeDefined();
  });

  test("the record shows the zone as a table, the notice outcome and a disabled suspend with its reason", async () => {
    await open(`/releases/permits/P-014`, {
      [`GET ${PERMITS}`]: page([SUSPENDED]),
      [`GET ${PERMITS}${ID}/`]: Response.json(SUSPENDED),
    });
    expect(await screen.findByRole("heading", { level: 1, name: /P-014/ })).toBeDefined();
    expect(
      screen.getByRole("table", { name: "Vértices de la zona oficial del permiso" }),
    ).toBeDefined();
    const notices = screen.getByRole("table", {
      name: "Resultado del aviso por tipo de destinatario",
    });
    expect(
      within(notices).getByText("Sin canal de entrega; verán el bloqueo al sincronizar"),
    ).toBeDefined();
    expect(screen.getByText("La autoridad pidió pausar el permiso")).toBeDefined();
    const suspend = screen.getByRole("button", { name: "Suspender ahora" });
    expect(suspend).toHaveProperty("disabled", true);
    expect(suspend.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("El permiso ya está suspendido.")).toBeDefined();
  });

  test("suspending needs a reason, sends the revision and keeps the reason on a 409", async () => {
    const { api } = await open(`/releases/permits/P-014`, {
      [`GET ${PERMITS}`]: page([permit()]),
      [`GET ${PERMITS}${ID}/`]: Response.json(permit()),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Suspender ahora" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Motivo"), "corto");
    await userEvent.click(within(dialog).getByRole("button", { name: "Suspender ahora" }));
    expect(await within(dialog).findByText(/al menos 10 caracteres/)).toBeDefined();
    expect(posts(api)).toHaveLength(0);
    const conflict = Response.json(
      {
        code: "release_state_conflict",
        detail: "x",
        blocked_by: [{ reason: "permit_revision_conflict", unblocked_by_role: "admin", link: "" }],
      },
      { status: 409 },
    );
    api.setRoute(`POST ${PERMITS}${ID}/suspend/`, conflict);
    await userEvent.type(within(dialog).getByLabelText("Motivo"), " reason is long enough");
    await userEvent.click(within(dialog).getByRole("button", { name: "Suspender ahora" }));
    expect(
      await within(dialog).findByText(/El permiso cambió mientras lo revisabas/),
    ).toBeDefined();
    expect(posts(api)[0]?.body).toEqual({
      reason: "corto reason is long enough",
      expected_revision: 1,
    });
    expect(
      within(dialog).getByRole<HTMLTextAreaElement>("textbox", { name: "Motivo" }).value,
    ).toContain("corto");
  });

  test("the record has no axe violation", async () => {
    const { app } = await open(`/releases/permits/P-014`, {
      [`GET ${PERMITS}`]: page([permit()]),
      [`GET ${PERMITS}${ID}/`]: Response.json(permit()),
    });
    await screen.findByRole("heading", { level: 1, name: /P-014/ });
    expect(await axe(app.container)).toHaveNoViolations();
  });

  test("without permit.suspend the suspend control is not shown; an unknown code is not found", async () => {
    const me = makeMe({ permissions: ["permit.manage"], scope: WHOLE });
    await open(`/releases/permits/P-404`, { [`GET ${PERMITS}`]: page([]) }, me);
    expect(await screen.findByText("No encontramos esta página")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Suspender ahora" })).toBeNull();
  });

  test("a user without permit.manage gets the no-permission state and no request", async () => {
    const me = makeMe({ permissions: ["catalog.read"] });
    const { api } = await open("/releases/permits", { [`GET ${PERMITS}`]: page([permit()]) }, me);
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Permisos" })).toBeNull();
    });
    expect(api.requests.some((request) => request.path.startsWith(PERMITS))).toBe(false);
  });
});
