import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, test } from "vitest";
import { apiError, makeMe } from "../test/fake-api";
import type { RecordedRequest } from "../test/fake-api";
import type { HistoryTab } from "./fleet-history-table";
import {
  ALLOWED,
  GET,
  LIST,
  motorcycle,
  openFleet,
  otherReasonField,
  pageOf,
  motorcycleDetail,
  serviceRecord,
  responsibilityLetter,
  fuelLoad,
  fleetFault,
  historyPage,
  settleFleet,
} from "./fleet-test-helpers";
const RECORD = `${LIST}/M-03`;
const UNBLOCK = `POST /api/v1/motorcycles/${motorcycle().id}/unblock/`;
const VOID = `POST /api/v1/motorcycles/${motorcycle().id}/void/`;
const REASON = "Repair checked and documented";
function historyRows(tab: HistoryTab): unknown[] {
  if (tab === "services")
    return [
      serviceRecord({
        voided_at: "2026-11-02T12:00:00Z",
        void_reason: "Historical service correction",
      }),
    ];
  if (tab === "responsibility") return [responsibilityLetter()];
  if (tab === "incidents") return [fleetFault()];
  const comparable = fuelLoad({
    is_full_refill: true,
    baseline: "00000000-0000-4000-8000-000000000031",
    efficiency_km_l: "21.50",
    efficiency_status: "review",
    threshold_min: "24",
    threshold_max: "38",
  });
  return [
    comparable,
    fuelLoad({
      ...comparable,
      id: "00000000-0000-4000-8000-000000000032",
      provisional: true,
      efficiency_km_l: "99.99",
    }),
    fuelLoad({ id: "00000000-0000-4000-8000-000000000033" }),
  ];
}
function assertFuelFacts(caption: string) {
  expect(screen.getByText("21.50 km/L")).toBeDefined();
  expect(screen.getByText(/24–38 km\/L/)).toBeDefined();
  expect(screen.queryByText("99.99 km/L")).toBeNull();
  expect(
    within(screen.getByRole("table", { name: caption })).getAllByText("Datos insuficientes"),
  ).toHaveLength(2);
}
function historyReply(target: { tab: HistoryTab; rows: unknown[] }, request: RecordedRequest) {
  const query = new URL(request.path, "https://test.invalid").searchParams;
  if (
    (target.tab === "services" || target.tab === "responsibility") &&
    query.get("include_voided") === "false"
  )
    return historyPage([]);
  if (target.tab === "fuel" && query.get("efficiency_status") === "review")
    return historyPage([target.rows[0]]);
  return historyPage(target.rows, 25 + target.rows.length);
}
const FUEL_SEARCH =
  "&fuel_courier=00000000-0000-4000-8000-000000000014&fuel_date_from=2026-09-01T00%3A00%3A00Z&fuel_date_before=2026-11-01T00%3A00%3A00Z";
function assertFuelFilters(query: URLSearchParams) {
  expect(query.get("courier")).toBe("00000000-0000-4000-8000-000000000014");
  expect(query.get("date_from")).toBe("2026-09-01T00:00:00Z");
  expect(query.get("date_before")).toBe("2026-11-01T00:00:00Z");
  expect(screen.queryByRole("textbox", { name: "Referencia de repartidor" })).toBeNull();
}
async function selectFuelFilter(
  opened: Awaited<ReturnType<typeof openFleet>>,
  query: URLSearchParams,
  caption: string,
) {
  const { api, app } = opened;
  assertFuelFilters(query);
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Comparación de rendimiento" }),
    "review",
  );
  await waitFor(() => {
    expect(within(screen.getByRole("table", { name: caption })).getAllByRole("row")).toHaveLength(
      2,
    );
  });
  const filtered = api.requests.find(
    (row) =>
      row.path.startsWith("/api/v1/fuel-loads/") && row.path.includes("efficiency_status=review"),
  );
  const current = new URL(filtered?.path ?? "", "https://test.invalid").searchParams;
  expect(current.get("page")).toBe("1");
  assertFuelFilters(current);
  expect(app.router.state.location.search).toHaveProperty("page", "3");
  expect(app.router.state.location.search).toHaveProperty("fuel_efficiency_status", "review");
}
function assertHistoryFacts(target: { tab: HistoryTab; caption: string }, query: URLSearchParams) {
  const { tab, caption } = target;
  expect(query.has("include_voided")).toBe(tab === "services" || tab === "responsibility");
  if (tab === "services") expect(screen.getByText(/Historical service correction/)).toBeDefined();
  if (tab === "responsibility") {
    expect(screen.getByText("Synthetic responsibility letter")).toBeDefined();
    expect(
      screen.queryByRole("link", { name: responsibilityLetter().document_reference ?? "" }),
    ).toBeNull();
  }
  if (tab === "incidents" || tab === "fuel") expect(query.get("motorcycle")).toBe(motorcycle().id);
  if (tab === "incidents") expect(query.get("kind")).toBe("fleet");
  if (tab === "fuel") assertFuelFacts(caption);
}

describe("W21 motorcycle record", () => {
  test("resolves code with voided records included and preserves list filters across tab deep links", async () => {
    let release: (reply: Response) => void = () => undefined;
    const serviceReply = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const servicePath = `/api/v1/motorcycles/${motorcycle().id}/services/`;
    const { app, api, reads } = await openFleet({
      path: `${RECORD}?tab=fuel&is_blocked=true&page=2`,
      routes: { [`GET ${servicePath}`]: () => serviceReply.then((reply) => reply.clone()) },
    });
    await screen.findByText("Datos insuficientes");
    expect(
      api.requests.some(({ path }) => path === `/api/v1/motorcycles/${motorcycle().id}/`),
    ).toBe(true);
    await screen.findByRole("table", { name: "Combustible" });
    expect(
      api.requests.some(
        ({ path }) =>
          path.startsWith("/api/v1/fuel-loads/?") &&
          new URL(path, "https://test.invalid").searchParams.get("motorcycle") === motorcycle().id,
      ),
    ).toBe(true);
    const historyBoundary = reads.length;
    await userEvent.click(screen.getByRole("link", { name: "Servicios" }));
    await waitFor(() => {
      expect(app.router.state.location.search).toEqual({
        tab: "services",
        is_blocked: "true",
        page: "2",
      });
    });
    expect(screen.getByRole("link", { name: "Volver a motos" }).getAttribute("href")).toBe(
      `${LIST}?is_blocked=true&page=2`,
    );
    await waitFor(() => {
      expect(
        reads
          .slice(historyBoundary)
          .some(
            (read) =>
              new URL(read.request.url).pathname === servicePath &&
              !read.request.signal.aborted &&
              !read.response,
          ),
      ).toBe(true);
    });
    expect(
      within(screen.getByRole("main")).queryByRole("link", { name: fuelLoad().id }),
    ).toBeNull();
    release(historyPage([serviceRecord()]));
    await settleFleet({ app, api, reads }, { since: historyBoundary, kind: "services" });
    await screen.findByRole("table", { name: "Servicios" });
    const requests = api.requests.filter(({ path }) => path.startsWith("/api/v1/motorcycles/"));
    expect(requests).toHaveLength(3);
    expect(
      Object.fromEntries(new URL(requests[0]?.path ?? "", "http://test").searchParams),
    ).toEqual({ code: "M-03", include_voided: "true", page: "1" });
  });
  test("names an unknown tab and falls back to summary without changing other parameters", async () => {
    const { app } = await openFleet({
      path: `${RECORD}?tab=alien&is_blocked=true&fuel_page=2&fuel_efficiency_status=review`,
    });
    await screen.findByText(/no se aplicaron: tab/);
    expect(screen.getByRole("link", { name: "Resumen" }).getAttribute("aria-current")).toBe("page");
    expect(app.router.state.location.search).toEqual({
      tab: "alien",
      is_blocked: "true",
      fuel_page: "2",
      fuel_efficiency_status: "review",
    });
    await userEvent.click(screen.getByRole("button", { name: "Quitar de la dirección" }));
    await waitFor(() => {
      expect(app.router.state.location.search).toEqual({
        is_blocked: "true",
        fuel_page: "2",
        fuel_efficiency_status: "review",
      });
    });
  });
  test.each(["UNKNOWN", "FOREIGN"])("%s has the same not-found state", async (code) => {
    const { api } = await openFleet({ path: `${LIST}/${code}`, routes: { [GET]: pageOf([]) } });
    await screen.findByRole("heading", { name: "No encontramos esta página" });
    expect(
      api.requests.some(
        ({ path }) =>
          path.startsWith("/api/v1/motorcycles/") &&
          new URL(path, "http://test").searchParams.get("code") === code,
      ),
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Desbloquear" })).toBeNull();
  });
  test("reason evidence unblocks the motorcycle, refreshes to available, and returns focus", async () => {
    let current = motorcycle();
    const { api } = await openFleet({
      path: RECORD,
      me: makeMe({
        ...ALLOWED,
        limits: { ...ALLOWED.limits, void_reason_min_length: 15, void_reason_max_length: 75 },
      }),
      routes: {
        [GET]: () => pageOf([current]),
        [UNBLOCK]: () => {
          current = motorcycle({ is_blocked: false, blocked_reason: "" });
          return Response.json(current);
        },
      },
    });
    const opener = await screen.findByRole("button", { name: "Desbloquear" });
    opener.focus();
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancelar" }),
    );
    expect(within(screen.getByRole("dialog")).queryByRole("combobox")).toBeNull();
    const dialog = within(screen.getByRole("dialog"));
    const reason = dialog.getByRole<HTMLTextAreaElement>("textbox", { name: /Motivo y evidencia/ });
    const confirm = dialog.getByRole<HTMLButtonElement>("button", { name: "Desbloquear" });
    expect(reason.required).toBe(true);
    expect(reason.maxLength).toBe(75);
    const description = (reason.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ");
    expect(description).toContain("al menos 15 caracteres");
    expect(confirm.disabled).toBe(true);
    await userEvent.type(reason, `${"a".repeat(14)}\u200b`);
    expect(confirm.disabled).toBe(true);
    await userEvent.clear(reason);
    await userEvent.type(reason, `  ${REASON}  `);
    expect(confirm.disabled).toBe(false);
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Desbloquear" }),
    );
    await screen.findByText("Disponible");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(api.requests.filter(({ method }) => method === "POST")).toHaveLength(1);
    expect(api.requests.find(({ method }) => method === "POST")?.body).toEqual({ reason: REASON });
    expect(api.requests.some(({ path }) => path.includes("/catalogs/void-reason/"))).toBe(false);
  });
  test.each([
    [403, "permission_denied", "permiso"],
    [404, "not_found", "No encontramos"],
    [409, "motorcycle_not_blocked", "ya está desbloqueada"],
    [409, "motorcycle_inspection_required", "inspección"],
    [409, "unexpected_conflict", "No pudimos completar"],
  ] as const)(
    "unblock refusal %s/%s retains evidence and conflicts refresh state",
    async (status, code, message) => {
      let release: (reply: Response) => void = () => undefined;
      const refreshed = new Promise<Response>((resolve) => {
        release = resolve;
      });
      let reads = 0;
      await openFleet({
        path: RECORD,
        routes: {
          [GET]: () => (++reads === 1 ? pageOf() : refreshed),
          [UNBLOCK]: apiError(status, code),
        },
      });
      await userEvent.click(await screen.findByRole("button", { name: "Desbloquear" }));
      await userEvent.type(within(screen.getByRole("dialog")).getByRole("textbox"), REASON);
      await userEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Desbloquear" }),
      );
      expect((await within(screen.getByRole("dialog")).findByRole("alert")).textContent).toContain(
        message,
      );
      expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(REASON);
      expect(document.activeElement).toBe(within(screen.getByRole("dialog")).getByRole("alert"));
      if (status === 409) {
        release(pageOf([motorcycle({ is_blocked: false, blocked_reason: "" })]));
        await screen.findByText("Disponible");
      }
      expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(REASON);
    },
  );

  test("void in an open shift keeps the dialog and evidence and refreshes the record", async () => {
    let reads = 0;
    await openFleet({
      path: RECORD,
      routes: {
        [GET]: () => {
          reads++;
          return pageOf();
        },
        [VOID]: apiError(409, "motorcycle_in_use"),
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Anular" }));
    await userEvent.type(await otherReasonField(), REASON);
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Anular" }),
    );
    expect((await within(screen.getByRole("dialog")).findByRole("alert")).textContent).toContain(
      "jornada abierta",
    );
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(REASON);
    await waitFor(() => {
      expect(reads).toBeGreaterThan(1);
    });
  });
  test.each([
    {
      tab: "services",
      prefix: "service_",
      caption: "Servicios",
      endpoint: `/api/v1/motorcycles/${motorcycle().id}/services/`,
    },
    {
      tab: "responsibility",
      prefix: "letter_",
      caption: "Responsivas",
      endpoint: `/api/v1/motorcycles/${motorcycle().id}/responsibility-letters/`,
    },
    { tab: "fuel", prefix: "fuel_", caption: "Combustible", endpoint: "/api/v1/fuel-loads/" },
    {
      tab: "incidents",
      prefix: "incident_",
      caption: "Incidentes",
      endpoint: "/api/v1/incidents/",
    },
  ] as const)(
    "$tab consumes the actual accepted page with its own URL and provenance",
    async ({ tab, prefix, caption, endpoint }) => {
      const rows = historyRows(tab);
      const opened = await openFleet({
        path: `${RECORD}?tab=${tab}&${prefix}page=2&${prefix}ordering=-created_at&${prefix}include_voided=true&is_blocked=true&page=3${tab === "fuel" ? FUEL_SEARCH : ""}`,
        routes: {
          [`GET ${endpoint}`]: (request) => historyReply({ tab, rows }, request),
        },
      });
      const { api, app } = opened;
      await screen.findByRole("table", { name: caption });
      const request = api.requests.find(
        (row) => new URL(row.path, "https://test.invalid").pathname === endpoint,
      );
      const query = new URL(request?.path ?? "", "https://test.invalid").searchParams;
      expect(query.get("page")).toBe("2");
      expect(query.get("ordering")).toBe("-created_at");
      expect(query.has("is_blocked")).toBe(false);
      expect(query.has(prefix + "page")).toBe(false);
      expect(app.router.state.location.search).toHaveProperty("page", "3");
      assertHistoryFacts({ tab, caption }, query);
      if (tab === "fuel") {
        await selectFuelFilter(opened, query, caption);
      }
      if (tab === "services" || tab === "responsibility")
        expect(query.get("include_voided")).toBe("true");
      if (tab === "services" || tab === "responsibility") {
        const toggle = screen.getByRole<HTMLInputElement>("checkbox", { name: "Incluir anulados" });
        expect(toggle.checked).toBe(true);
        await userEvent.click(toggle);
        await screen.findByText("Aquí todavía no hay registros");
        expect(api.requests.some((row) => row.path.includes("include_voided=false"))).toBe(true);
        expect(app.router.state.location.search).toHaveProperty("page", "3");
        expect(app.router.state.location.search[prefix + "include_voided"]).toBeUndefined();
        expect(screen.queryByText(/Historical service correction/)).toBeNull();
      }
    },
  );
  test("summary uses actual nullable metrics and source tabs without claiming an off-page detail lookup", async () => {
    const source = "00000000-0000-4000-8000-000000000039";
    let known = false;
    const { api } = await openFleet({
      path: RECORD,
      routes: {
        [`GET /api/v1/motorcycles/${motorcycle().id}/`]: () =>
          Response.json(
            motorcycleDetail({
              metrics: {
                last_service: source,
                next_service_due_km: 13000,
                next_service_due_date: "2026-12-05",
                latest_odometer: 12521,
                latest_efficiency: "44.00",
                efficiency_status: known ? "ok" : "unrecognized",
                due_metric_provenance: { source: "service_record", source_id: source },
              },
            }),
          ),
      },
    });
    await screen.findByText("13,000");
    expect(screen.getByText("12,521")).toBeDefined();
    expect(screen.getByText("Datos insuficientes")).toBeDefined();
    expect(screen.queryByText("44.00 km/L")).toBeNull();
    known = true;
    await userEvent.click(screen.getByRole("button", { name: "Actualizar ficha" }));
    await screen.findByText("44.00 km/L");
    await userEvent.click(screen.getByRole("link", { name: source }));
    await screen.findByRole("table", { name: "Servicios" });
    expect(screen.getByText(new RegExp(`Origen ${source}`))).toBeDefined();
    expect(
      api.requests
        .filter((request) => request.path.includes("/services/"))
        .map((request) => new URL(request.path, "https://test.invalid").pathname),
    ).toEqual([`/api/v1/motorcycles/${motorcycle().id}/services/`]);
  });
  test.each(["es-MX", "en"] as const)(
    "record and reason dialog have no axe violations in %s",
    async (language) => {
      const { app } = await openFleet({
        path: RECORD,
        language,
        me: makeMe({
          ...ALLOWED,
          permissions: [...ALLOWED.permissions, "motorcycle.service_clear", "field.upload"],
        }),
        routes: { "GET /api/v1/incidents/": () => historyPage([fleetFault()]) },
      });
      const label = language === "en" ? "Unblock" : "Desbloquear";
      await screen.findByRole("button", { name: label });
      expect(await axe(app.container)).toHaveNoViolations();
      await userEvent.click(screen.getByRole("button", { name: label }));
      expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
      await userEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: language === "en" ? "Cancel" : "Cancelar",
        }),
      );
      await userEvent.click(
        screen.getByRole("button", {
          name: language === "en" ? "Register service" : "Registrar servicio",
        }),
      );
      expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
      await userEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: language === "en" ? "Cancel" : "Cancelar",
        }),
      );
      const tabs = within(
        screen.getByRole("navigation", {
          name: language === "en" ? "Motorcycle record sections" : "Secciones de la ficha de moto",
        }),
      );
      await userEvent.click(
        tabs.getByRole("link", { name: language === "en" ? "Incidents" : "Incidentes" }),
      );
      await userEvent.click(
        await screen.findByRole("button", {
          name: language === "en" ? "Clear this severe fault" : "Liberar esta falla grave",
        }),
      );
      expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
    },
  );
});
