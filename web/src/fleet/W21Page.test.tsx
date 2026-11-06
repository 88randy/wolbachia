import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, test } from "vitest";
import { apiError, makeMe } from "../test/fake-api";
import {
  ALLOWED,
  GET,
  LIST,
  motorcycle,
  openFleet,
  otherReasonField,
  pageOf,
} from "./fleet-test-helpers";
const RECORD = `${LIST}/M-03`;
const UNBLOCK = `POST /api/v1/motorcycles/${motorcycle().id}/unblock/`;
const VOID = `POST /api/v1/motorcycles/${motorcycle().id}/void/`;
const REASON = "Repair checked and documented";

describe("W21 motorcycle record", () => {
  test("resolves code with voided records included and preserves list filters across tab deep links", async () => {
    const { app, api } = await openFleet({ path: `${RECORD}?tab=fuel&is_blocked=true&page=2` });
    await screen.findByText("Datos insuficientes");
    expect(screen.getByText(/cargas de combustible.*B-05/i)).toBeDefined();
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
    const requests = api.requests.filter(({ path }) => path.startsWith("/api/v1/motorcycles/"));
    expect(requests).toHaveLength(1);
    expect(
      Object.fromEntries(new URL(requests[0]?.path ?? "", "http://test").searchParams),
    ).toEqual({ code: "M-03", include_voided: "true", page: "1" });
  });
  test("names an unknown tab and falls back to summary without changing other parameters", async () => {
    const { app } = await openFleet({ path: `${RECORD}?tab=alien&is_blocked=true` });
    await screen.findByText(/no se aplicaron: tab/);
    expect(screen.getByRole("link", { name: "Resumen" }).getAttribute("aria-current")).toBe("page");
    expect(app.router.state.location.search).toEqual({ tab: "alien", is_blocked: "true" });
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
    ["services", /historial de servicios/],
    ["responsibility", /historial de responsivas/],
    ["fuel", /cargas de combustible/],
    ["incidents", /historial de incidentes/],
  ] as const)("%s states the missing backend history explicitly", async (tab, missingWork) => {
    await openFleet({ path: `${RECORD}?tab=${tab}` });
    await screen.findByText("Todavía no disponible");
    expect(screen.getByText(missingWork).textContent).toContain("B-05");
    expect(screen.queryByRole("table")).toBeNull();
  });
  test.each(["es-MX", "en"] as const)(
    "record and reason dialog have no axe violations in %s",
    async (language) => {
      const { app } = await openFleet({ path: RECORD, language });
      const label = language === "en" ? "Unblock" : "Desbloquear";
      await screen.findByRole("button", { name: label });
      expect(await axe(app.container)).toHaveNoViolations();
      await userEvent.click(screen.getByRole("button", { name: label }));
      expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
    },
  );
});
