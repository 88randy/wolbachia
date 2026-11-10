import { ID, PROOF, event, incident } from "../test/incident-fixtures";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createFakeApi, makeMe, apiError } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { renderApp } from "../test/render-app";
beforeEach(() => {
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});
const LIST = "GET /api/v1/incidents/";
const DETAIL = `GET /api/v1/incidents/${ID}/`;
const permissions = [
  "incident.read",
  "incident.create",
  "incident.reassign",
  "incident.close",
  "field.upload",
];
const page = (results = [incident()], count = results.length) =>
  Response.json({ count, next: null, previous: null, results });
async function open(path = "/incidents", overrides: FakeApiRoutes = {}, allowed = permissions) {
  const me = makeMe({
    permissions: allowed,
    scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
  });
  const api = createFakeApi({
    "GET /api/v1/incident-types/": page([]),
    "GET /api/v1/incidents/context-options/": page([]),
    "GET /api/v1/me/": Response.json(me),
    [LIST]: () => page(),
    [DETAIL]: () => Response.json(incident()),
    [`GET /api/v1/incidents/${ID}/owner-options/`]: () =>
      Response.json({
        count: 0,
        next: null,
        previous: null,
        results: [],
      }),
    ...overrides,
  });
  const app = await renderApp({ path, fetch: api.fetch });
  return { api, app };
}
describe("W6 incident tray", () => {
  test("loads with a skeleton and keeps available rows when one count fails", async () => {
    let release: (reply: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { api } = await open("/incidents", {
      [LIST]: (request) => {
        const query = new URL(request.path, "https://test.invalid").searchParams;
        if (query.get("assigned_to_me") === "true") return apiError(503, "unavailable");
        return query.get("page_size") === "25" ? held : page();
      },
    });
    await screen.findByRole("status", { name: "Cargando contenido" });
    await screen.findByRole("alert");
    release(page());
    await screen.findByRole("link", { name: "I-0033" });
    expect(screen.getByRole("link", { name: "De mi zona 1" })).toBeDefined();
    api.setRoute(LIST, page());
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("link", { name: "Míos 1" });
  });
  test("marks voided rows with the retained reason and author", async () => {
    const record = incident({
      state: "voided",
      timeline: [
        ...incident().timeline,
        {
          ...event,
          action: "void",
          state: "voided",
          text: "Duplicate report",
          author_display: "Test reviewer",
        },
      ],
    });
    await open("/incidents?state=voided", { [LIST]: page([record]) });
    const row = (await screen.findByRole("link", { name: "I-0033" })).closest("tr");
    if (!row) throw new Error("Incident row not found");
    expect(row.className).toMatch(/voided/);
    expect(within(row).getByText(/Duplicate report/)).toBeDefined();
    expect(within(row).getByText(/Test reviewer/)).toBeDefined();
  });
  test("every header count opens its server filtered list and resets paging", async () => {
    const { api, app } = await open("/incidents?page=2");
    for (const [label, param] of [
      ["Míos", "assigned_to_me"],
      ["Vencidos", "overdue"],
      ["Cerrados", "state"],
      ["De mi zona", "state"],
    ] as const) {
      const link = await screen.findByRole("link", { name: new RegExp(`${label}.*1`) });
      expect(link.getAttribute("href")).not.toContain("undefined");
      await userEvent.click(link);
      await waitFor(() => {
        expect(app.router.state.location.search["page"]).toBeUndefined();
      });
      await waitFor(() => {
        expect(
          api.requests.some(({ path }) =>
            path.includes(
              `${param}=${label === "Cerrados" ? "closed" : param === "state" ? "open" : "true"}`,
            ),
          ),
        ).toBe(true);
      });
    }
    expect((await screen.findByRole("link", { name: "I-0033" })).getAttribute("href")).toContain(
      "/incidents/I-0033",
    );
    expect(
      api.requests
        .filter(({ path }) => path.startsWith("/api/v1/incidents/?"))
        .every(({ path }) => path.includes("kind=reported")),
    ).toBe(true);
  });
  test("denies reads without incident.read", async () => {
    const { api } = await open("/incidents/I-0033", {}, ["incident.close"]);
    await screen.findByRole("heading", { name: "No tienes acceso a esta sección" });
    expect(api.requests.some(({ path }) => path.startsWith("/api/v1/incidents/"))).toBe(false);
  });
  test("shows a scoped error and retries to an empty filtered list", async () => {
    const { api } = await open("/incidents?severity=high", {
      [LIST]: apiError(503, "unavailable"),
    });
    await screen.findAllByRole("alert");
    api.setRoute(LIST, page([]));
    for (const retry of screen.getAllByRole("button", { name: "Reintentar" }))
      await userEvent.click(retry);
    await screen.findByText("Sin resultados con estos filtros");
  });
});
describe("W7 incident detail", () => {
  test("translates blocker kinds and keeps unknown blockers readable", async () => {
    const resource = incident().linked_record;
    const blockers = ["dispatch", "quadrant_closure", "lot_dispatch", "future_kind"].map(
      (kind, index) => ({ id: String(index), kind, is_active: true, resource }),
    );
    await open("/incidents/I-0033", { [DETAIL]: Response.json(incident({ blockers })) });
    for (const label of [
      "Salida de insumos",
      "Cierre de cuadrante",
      "Salida de lote",
      "Operación bloqueada",
    ])
      expect(await screen.findByText(label, { exact: false })).toBeDefined();
    for (const kind of ["quadrant_closure", "lot_dispatch", "future_kind"])
      expect(screen.queryByText(kind, { exact: false })).toBeNull();
  });
  test("keeps in-memory drafts and evidence after a failed refresh until retry succeeds", async () => {
    const { api, app } = await open("/incidents/I-0033");
    const view = within(app.container);
    await view.findByRole("heading", { name: /I-0033/ });
    const storageRead = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("Storage denied");
    });
    const comment = view.getByRole("textbox", { name: "Comentario" });
    await userEvent.type(comment, "Keep the in-memory draft");
    const file = new File(["synthetic"], "retained.png", { type: "image/png" });
    const input = view.getByLabelText<HTMLInputElement>("Foto de evidencia");
    await userEvent.upload(input, file);
    api.setRoute(DETAIL, apiError(503, "unavailable"));
    await act(() =>
      app.queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          queryKey[3] === "incidents" && queryKey[4] === "detail" && queryKey[5] === "I-0033",
      }),
    );
    await view.findByRole("alert");
    expect(view.getByRole("heading", { name: /I-0033/ })).toBeDefined();
    expect(view.getByRole("textbox", { name: "Comentario" })).toBe(comment);
    expect(comment).toHaveProperty("value", "Keep the in-memory draft");
    expect(view.getByLabelText("Foto de evidencia")).toBe(input);
    expect(input.files?.[0]).toBe(file);
    expect(
      view.getByRole("button", { name: "Enviar comentario" }).getAttribute("aria-disabled"),
    ).toBe("true");
    api.setRoute(DETAIL, Response.json(incident()));
    await userEvent.click(
      within(view.getByRole("alert")).getByRole("button", { name: "Reintentar" }),
    );
    await waitFor(() => {
      expect(view.queryByRole("alert")).toBeNull();
    });
    expect(comment).toHaveProperty("value", "Keep the in-memory draft");
    expect(input.files?.[0]).toBe(file);
    expect(
      view.getByRole("button", { name: "Enviar comentario" }).getAttribute("aria-disabled"),
    ).toBe("false");
    storageRead.mockRestore();
  });
  test("resolves a human code and renders the full audit thread and voided source", async () => {
    const { api } = await open("/incidents/I-0033");
    await screen.findByRole("heading", { name: /I-0033/ });
    expect(screen.getByText("Original report")).toBeDefined();
    expect(screen.getByText("Synthetic incident")).toBeDefined();
    expect(screen.getByText("Escalation audit")).toBeDefined();
    expect(screen.getByRole("link", { name: /M-03.*Anulado/ }).getAttribute("href")).toBe(
      "/fleet/motorcycles/M-03",
    );
    expect(screen.getByText("Escalado")).toBeDefined();
    expect(api.requests.find(({ path }) => path.includes("code=I-0033"))).toBeDefined();
  });
  test("cannot submit close until verified evidence satisfies the type", async () => {
    const { api } = await open("/incidents/I-0033");
    await screen.findByRole("heading", { name: /I-0033/ });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Motivo de cierre" }),
      "Resolved safely",
    );
    const close = screen.getByRole("button", { name: "Cerrar incidente" });
    expect(close.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(close);
    expect(api.requests.some(({ method }) => method === "POST")).toBe(false);
  });
  test("close sends only verified evidence with the reviewed revision after confirmation", async () => {
    const record = incident({
      evidence: [
        {
          id: PROOF,
          is_readable: true,
          is_verified: true,
          verified_at: event.created_at,
          content_type: "image/png",
          size_bytes: 20,
        },
      ],
    });
    const { api } = await open("/incidents/I-0033", {
      [DETAIL]: Response.json(record),
      [`POST /api/v1/incidents/${ID}/close/`]: Response.json({ ...event, action: "close" }),
    });
    await screen.findByRole("heading", { name: /I-0033/ });
    await userEvent.type(
      screen.getByRole("textbox", { name: "Motivo de cierre" }),
      "Resolved safely",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cerrar incidente" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Cerrar incidente" }),
    );
    await waitFor(() => {
      expect(api.requests.find(({ method }) => method === "POST")?.body).toEqual({
        expected_revision: 2,
        reason: "Resolved safely",
        evidence_ids: [PROOF],
      });
    });
  });
  test("conflict retains the comment and blocks commands until explicit review", async () => {
    const { api } = await open("/incidents/I-0033", {
      [`POST /api/v1/incidents/${ID}/comments/`]: apiError(409, "incident_conflict"),
    });
    await screen.findByRole("heading", { name: /I-0033/ });
    await userEvent.type(screen.getByRole("textbox", { name: "Comentario" }), "Keep this draft");
    await userEvent.click(screen.getByRole("button", { name: "Enviar comentario" }));
    await screen.findByText(/Otra persona modificó/);
    expect(screen.getByRole("textbox", { name: "Comentario" })).toHaveProperty(
      "value",
      "Keep this draft",
    );
    expect(
      screen.getByRole("button", { name: "Enviar comentario" }).getAttribute("aria-disabled"),
    ).toBe("true");
    expect(api.requests.filter(({ method }) => method === "POST")).toHaveLength(1);
  });
  test("hides actions excluded by the server projection", async () => {
    await open("/incidents/I-0033", {
      [DETAIL]: Response.json(
        incident({
          action_permissions: {
            comment: false,
            close: false,
            reassign: false,
            change_severity: false,
            void: false,
          },
        }),
      ),
    });
    await screen.findByRole("heading", { name: /I-0033/ });
    expect(screen.queryByRole("button", { name: "Cerrar incidente" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reasignar" })).toBeNull();
  });
});

test("keeps URL filters and supported sorting on the server", async () => {
  const { api, app } = await open();
  await screen.findByRole("link", { name: "I-0033" });
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Severidad" }), "high");
  await waitFor(() => {
    expect(app.router.state.location.search["severity"]).toBe("high");
  });
  await userEvent.click(
    within(await screen.findByRole("table")).getByRole("button", { name: "Número" }),
  );
  await waitFor(() => {
    expect(
      api.requests.some(
        ({ path }) => path.includes("severity=high") && path.includes("ordering=code"),
      ),
    ).toBe(true);
  });
  expect(app.router.state.location.search["severity"]).toBe("high");
});
test("an unknown human code never triggers a UUID detail read", async () => {
  const { api } = await open("/incidents/I-missing", { [LIST]: page([]) });
  await screen.findByRole("heading", { name: "No encontramos esta página" });
  expect(api.requests.some(({ path }) => path.includes(`/incidents/${ID}/`))).toBe(false);
});
test("reassigns only to an eligible membership and changes severity with the current revision", async () => {
  const owner = "00000000-0000-4000-8000-000000000050";
  const { api } = await open("/incidents/I-0033", {
    [`GET /api/v1/incidents/${ID}/owner-options/`]: () =>
      Response.json({
        count: 1,
        next: null,
        previous: null,
        results: [{ membership_id: owner, label: "Eligible owner" }],
      }),
    [`POST /api/v1/incidents/${ID}/reassign/`]: Response.json(event),
    [`POST /api/v1/incidents/${ID}/change-severity/`]: Response.json(event),
  });
  await screen.findByRole("option", { name: "Eligible owner" });
  api.setRoute(DETAIL, () =>
    Response.json(incident({ revision: 3, owner_id: owner, owner_display: "Reassigned owner" })),
  );
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Responsable" }), owner);
  await userEvent.click(screen.getByRole("button", { name: "Reasignar" }));
  await waitFor(() => {
    expect(
      api.requests.find(({ path, method }) => method === "POST" && path.endsWith("/reassign/"))
        ?.body,
    ).toEqual({ expected_revision: 2, owner_id: owner });
  });
  await screen.findByText(/Reassigned owner/);
  await waitFor(() => {
    const reassign = screen.getByRole("button", { name: "Reasignar" });
    expect(reassign.closest("fieldset")?.getAttribute("disabled")).toBeNull();
    expect(reassign.getAttribute("aria-disabled")).toBe("false");
  });
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Severidad" }), "high");
  await waitFor(() => {
    const severity = screen.getByRole("button", { name: "Cambiar severidad" });
    expect(screen.getByRole("combobox", { name: "Severidad" })).toHaveProperty("value", "high");
    expect(severity.closest("fieldset")?.getAttribute("disabled")).toBeNull();
    expect(severity.getAttribute("aria-disabled")).toBe("false");
  });
  await userEvent.click(screen.getByRole("button", { name: "Cambiar severidad" }));
  await waitFor(() => {
    expect(
      api.requests.find(
        ({ path, method }) => method === "POST" && path.endsWith("/change-severity/"),
      )?.body,
    ).toEqual({ expected_revision: 3, severity: "high" });
  });
});

test("keeps previous owner options read-only while the next search is pending", async () => {
  const owner = "00000000-0000-4000-8000-000000000050";
  const route = `GET /api/v1/incidents/${ID}/owner-options/`;
  let release: (reply: Response) => void = () => undefined;
  const held = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const { api } = await open("/incidents/I-0033", {
    [route]: Response.json({
      count: 1,
      next: null,
      previous: null,
      results: [{ membership_id: owner, label: "Eligible owner" }],
    }),
  });
  await screen.findByRole("option", { name: "Eligible owner" });
  api.setRoute(route, () => held);
  await userEvent.click(screen.getByRole("textbox", { name: "Buscar responsable" }));
  await userEvent.paste("different");
  await waitFor(() => {
    expect(
      api.requests.some(
        (request) =>
          request.path.includes("owner-options/") && request.path.includes("search=different"),
      ),
    ).toBe(true);
  });
  const select = screen.getByRole("combobox", { name: "Responsable" });
  expect(screen.getByRole("option", { name: "Eligible owner" })).toBeDefined();
  expect(select).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Reasignar" }).getAttribute("aria-disabled")).toBe(
    "true",
  );
  await userEvent.click(screen.getByRole("button", { name: "Reasignar" }));
  expect(api.requests.some((request) => request.method === "POST")).toBe(false);
  release(Response.json({ count: 0, next: null, previous: null, results: [] }));
  await waitFor(() => {
    expect(screen.queryByRole("option", { name: "Eligible owner" })).toBeNull();
  });
  expect(select).toHaveProperty("disabled", false);
});
test("refuses duplicate comments while the first write is pending", async () => {
  let release: (reply: Response) => void = () => undefined;
  const held = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const { api } = await open("/incidents/I-0033", {
    [`POST /api/v1/incidents/${ID}/comments/`]: () => held,
  });
  await screen.findByRole("heading", { name: /I-0033/ });
  await userEvent.type(
    screen.getByRole("textbox", { name: "Comentario" }),
    "One immutable comment",
  );
  const button = screen.getByRole("button", { name: "Enviar comentario" });
  await userEvent.click(button);
  expect(screen.getByRole("textbox", { name: "Comentario" })).toHaveProperty("disabled", true);
  await userEvent.type(
    screen.getByRole("textbox", { name: "Comentario" }),
    " must not replace pending capture",
  );
  expect(screen.getByRole("textbox", { name: "Comentario" })).toHaveProperty(
    "value",
    "One immutable comment",
  );
  await userEvent.click(button);
  expect(api.requests.filter(({ method }) => method === "POST")).toHaveLength(1);
  release(Response.json({ ...event, action: "comment" }));
  await waitFor(() => {
    expect(screen.getByRole("textbox", { name: "Comentario" })).toHaveProperty("value", "");
  });
});

test("All is an explicit state and does not send an open-state predicate", async () => {
  const { api, app } = await open();
  await screen.findByRole("link", { name: "I-0033" });
  expect(screen.getByRole("combobox", { name: "Estado" })).toHaveProperty("value", "open");
  const boundary = api.requests.length;
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Estado" }), "all");
  await waitFor(() => {
    expect(app.router.state.location.search["state"]).toBe("all");
  });
  await waitFor(() => {
    expect(
      api.requests.slice(boundary).some(({ path }) => {
        const url = new URL(path, "https://test.invalid");
        return (
          url.pathname === "/api/v1/incidents/" &&
          url.searchParams.get("page_size") === "25" &&
          !url.searchParams.has("state")
        );
      }),
    ).toBe(true);
  });
});
