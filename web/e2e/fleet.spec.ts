import { expect, test } from "./fixtures/test";
import type { Schemas } from "@wolbachia/api-client";
import type { Page, Route } from "@playwright/test";
import { Buffer } from "node:buffer";
import { makeMe } from "../src/test/fake-api";
import { STORAGE_KEYS } from "../src/storage/safe-storage";
import { mockApi } from "./fixtures/mock-api";
import {
  LANGUAGES,
  THEMES,
  rememberPreferences,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./fixtures/a11y";

const RECORD: Schemas["Motorcycle"] = {
  id: "00000000-0000-4000-8000-000000000001",
  code: "M-03",
  plate: "TEST-03",
  center: null,
  revision: 0,
  is_blocked: true,
  blocked_reason: "out_of_service",
  created_at: "2026-10-01T15:00:00Z",
  created_by: null,
  voided_at: null,
  voided_by: null,
  void_reason_code: "",
  void_reason: "",
};
const VIEWPORT = { width: 320, height: 700 };
const FAULT_ID = "00000000-0000-4000-8000-000000000015";
const UPLOAD_ID = "00000000-0000-4000-8000-000000000023";
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=",
  "base64",
);
const audit = {
  motorcycle: RECORD.id,
  created_at: RECORD.created_at,
  created_by: null,
  voided_at: null,
  voided_by: null,
  void_reason_code: "",
  void_reason: "",
};
const SERVICE: Schemas["ServiceRecord"] = {
  ...audit,
  id: "00000000-0000-4000-8000-000000000010",
  kind: "inspection",
  performed_at: "2026-11-01",
  odometer_km: 12600,
  notes: "Inspection recorded separately",
  service_interval_km: null,
  service_interval_days: null,
  due_metric_provenance: {},
};
const LETTER: Schemas["ResponsibilityLetter"] = {
  ...audit,
  id: "00000000-0000-4000-8000-000000000017",
  courier: "00000000-0000-4000-8000-000000000014",
  issued_at: RECORD.created_at,
  document_reference: "00000000-0000-4000-8000-000000000018",
  notes: "Synthetic responsibility document",
};
interface FleetMock {
  record: Schemas["Motorcycle"];
  services: Schemas["ServiceRecord"][];
  faults: Schemas["Incident"][];
  writes: string[];
  verified: boolean;
}
function pageBody(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}
function expectWrite(route: Route) {
  expect(route.request().headers()["x-organization"]).toBe("norte");
  expect(route.request().headers()["x-csrftoken"]).toBe("e2e-csrf");
}
async function fleetWrite(route: Route, state: FleetMock) {
  expectWrite(route);
  const path = new URL(route.request().url()).pathname;
  state.writes.push(path);
  if (path.endsWith("/unblock/")) {
    expect(route.request().postDataJSON()).toEqual({ reason: "Repair checked and documented" });
    state.record = { ...state.record, revision: 1, is_blocked: false, blocked_reason: "" };
    return route.fulfill({ json: state.record });
  }
  if (path.endsWith("/services/")) {
    expect(route.request().postDataJSON()).toEqual({
      kind: "inspection",
      performed_at: SERVICE.performed_at,
      odometer_km: 12600,
      notes: SERVICE.notes,
      service_interval_km: null,
      service_interval_days: null,
    });
    state.services = [SERVICE];
    state.record = { ...state.record, revision: state.record.revision + 1 };
    return route.fulfill({ status: 201, json: SERVICE });
  }
  expect(path).toBe(`/api/v1/motorcycles/${RECORD.id}/clear-fault/`);
  expect(state.verified).toBe(true);
  expect(route.request().postDataJSON()).toEqual({
    fault_id: FAULT_ID,
    expected_revision: state.record.revision,
    evidence_ids: [UPLOAD_ID],
    reason: "Named inspection and original proof",
  });
  state.faults = state.faults.map((fault) => ({
    ...fault,
    is_cleared: true,
    cleared_at: "2026-11-07T12:00:00Z",
    clearance: {
      id: "00000000-0000-4000-8000-000000000024",
      created_at: "2026-11-07T12:00:00Z",
      reviewer: makeMe().user.id,
      reason: "Named inspection and original proof",
      evidence_ids: [UPLOAD_ID],
    },
  }));
  state.record = {
    ...state.record,
    revision: state.record.revision + 1,
    is_blocked: true,
    blocked_reason: "service_overdue",
  };
  return route.fulfill({ json: state.record });
}
async function fleetRead(route: Route, state: FleetMock) {
  const path = new URL(route.request().url()).pathname;
  if (path === "/api/v1/motorcycles/") return route.fulfill({ json: pageBody([state.record]) });
  if (path.endsWith("/services/")) return route.fulfill({ json: pageBody(state.services) });
  if (path.endsWith("/responsibility-letters/")) return route.fulfill({ json: pageBody([LETTER]) });
  expect(path).toBe(`/api/v1/motorcycles/${RECORD.id}/`);
  const detail: Schemas["MotorcycleDetail"] = {
    ...state.record,
    metrics: {
      last_service: state.services[0]?.id ?? null,
      latest_odometer: state.services[0]?.odometer_km ?? null,
      next_service_due_date: null,
      next_service_due_km: null,
      latest_efficiency: null,
      efficiency_status: "unavailable",
      due_metric_provenance: {},
    },
  };
  return route.fulfill({ json: detail });
}
async function fleetEvidence(route: Route, state: FleetMock) {
  expectWrite(route);
  const path = new URL(route.request().url()).pathname;
  if (route.request().method() === "PUT") {
    expect(path).toBe(`/api/v1/field/uploads/${UPLOAD_ID}/content/`);
    expect(route.request().headers()["upload-lease"]).toBe("synthetic-fleet-lease");
    expect(route.request().postDataBuffer()).toEqual(PNG_BYTES);
    return route.fulfill({ status: 204 });
  }
  if (path.endsWith("/finalize/")) {
    expect(route.request().postDataJSON()).toEqual({
      context: { kind: "motorcycle_fault", id: FAULT_ID },
    });
    state.verified = true;
    return route.fulfill({
      json: { id: UPLOAD_ID, state: "verified", verified_at: "2026-11-07T11:55:00Z" },
    });
  }
  expect(path).toBe("/api/v1/field/uploads/");
  expect(route.request().postDataJSON()).toMatchObject({
    content_type: "image/png",
    size_bytes: PNG_BYTES.length,
    client_id: expect.stringMatching(/^[a-f0-9-]{36}$/),
    sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    context: { kind: "motorcycle_fault", id: FAULT_ID },
  });
  return route.fulfill({
    status: 201,
    json: {
      upload_id: UPLOAD_ID,
      url: `/api/v1/field/uploads/${UPLOAD_ID}/content/`,
      method: "PUT",
      headers: { "Content-Type": "image/png", "Upload-Lease": "synthetic-fleet-lease" },
      expires_at: "2026-11-07T12:00:00Z",
    },
  });
}
async function installFleet(page: Page) {
  const state: FleetMock = {
    record: { ...RECORD },
    services: [],
    faults: [],
    writes: [],
    verified: false,
  };
  await page.route("**/api/v1/motorcycles/**", (route) =>
    route.request().method() === "POST" ? fleetWrite(route, state) : fleetRead(route, state),
  );
  await page.route("**/api/v1/field/uploads/**", (route) => fleetEvidence(route, state));
  await page.route(`**/api/v1/attachments/${UPLOAD_ID}/download/`, (route) => {
    expect(route.request().method()).toBe("GET");
    expect(route.request().headers()["x-organization"]).toBe("norte");
    return route.fulfill({ contentType: "image/png", body: PNG_BYTES });
  });
  await page.route("**/api/v1/fuel-loads/**", (route) => {
    expect(new URL(route.request().url()).searchParams.get("motorcycle")).toBe(RECORD.id);
    return route.fulfill({ json: pageBody([]) });
  });
  await page.route("**/api/v1/incidents/**", (route) => {
    const query = new URL(route.request().url()).searchParams;
    expect(query.get("motorcycle")).toBe(RECORD.id);
    expect(query.get("kind")).toBe("fleet");
    return route.fulfill({ json: pageBody(state.faults) });
  });
  return state;
}
async function increaseFleetText(page: Page) {
  const sizes = await page.evaluate(() => {
    const before = Number.parseFloat(getComputedStyle(document.body).fontSize);
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    for (const name of Array.from(computed).filter(
      (key) => key.startsWith("--web-type-") && key.endsWith("-font-size"),
    ))
      root.style.setProperty(
        name,
        String(Number.parseFloat(computed.getPropertyValue(name)) * 1.3) + "px",
      );
    return { before, after: Number.parseFloat(getComputedStyle(document.body).fontSize) };
  });
  expect(sizes.after).toBeCloseTo(sizes.before * 1.3, 1);
}
type LocaleCell = { language: (typeof LANGUAGES)[number]; theme: (typeof THEMES)[number] };
function recordTab(page: Page, name: string) {
  return page
    .getByRole("navigation", {
      name: /^(Motorcycle record sections|Secciones de la ficha de moto)$/,
    })
    .getByRole("link", { name, exact: true });
}
function writesIn(cell: LocaleCell) {
  return cell.language === "es-MX" && cell.theme === "light";
}
async function exerciseService(page: Page, cell: LocaleCell, fleet: FleetMock) {
  const en = cell.language === "en";
  const button = page.getByRole("button", {
    name: en ? "Register service" : "Registrar servicio",
    exact: true,
  });
  await expect(button).toHaveAttribute("aria-disabled", "false");
  await button.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: en ? "Cancel" : "Cancelar", exact: true }),
  ).toBeFocused();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(button).toBeFocused();
  if (!writesIn(cell)) return;
  await page.keyboard.press("Enter");
  await dialog.getByRole("combobox").selectOption("inspection");
  await dialog.getByLabel(en ? "Performed on" : "Fecha del servicio").fill(SERVICE.performed_at);
  await dialog
    .getByRole("spinbutton", { name: en ? "Odometer (km)" : "Odómetro (km)", exact: true })
    .fill("12600");
  await dialog.getByRole("textbox", { name: en ? "Notes" : "Observaciones" }).fill(SERVICE.notes);
  await dialog
    .getByRole("button", { name: en ? "Register service" : "Registrar servicio", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(button).toBeFocused();
  expect(fleet.writes.filter((path) => path.endsWith("/services/"))).toHaveLength(1);
  expect(fleet.faults[0]?.is_cleared).toBe(false);
}
function clearanceLabels(language: LocaleCell["language"]) {
  return language === "en"
    ? {
        incidents: "Incidents",
        clear: "Clear this severe fault",
        cancel: "Cancel",
        reason: "Inspection reason",
        files: "JPEG/PNG evidence",
        upload: "Upload and verify evidence",
        verified: /Verified evidence/,
        refresh: "Refresh record",
        overdue: /Service overdue/,
        proof: "Immutable clearance proof",
        download: "Download authorized evidence",
      }
    : {
        incidents: "Incidentes",
        clear: "Liberar esta falla grave",
        cancel: "Cancelar",
        reason: "Motivo de la inspección",
        files: "Evidencia JPEG/PNG",
        upload: "Cargar y verificar evidencia",
        verified: /Evidencia verificada/,
        refresh: "Actualizar ficha",
        overdue: /Servicio vencido/,
        proof: "Prueba inmutable de liberación",
        download: "Descargar evidencia autorizada",
      };
}
async function exerciseClearance(page: Page, cell: LocaleCell, fleet: FleetMock) {
  const labels = clearanceLabels(cell.language);
  await recordTab(page, labels.incidents).click();
  const button = page.getByRole("button", {
    name: labels.clear,
  });
  await expect(button).toHaveAttribute("aria-disabled", "false");
  await button.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  const cancel = dialog.getByRole("button", { name: labels.cancel, exact: true });
  await expect(cancel).toBeFocused();
  await expectNoAxeViolations(page);
  await expectNoHorizontalScroll(page);
  if (!writesIn(cell)) {
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
    return;
  }
  await dialog
    .getByRole("textbox", { name: labels.reason })
    .fill("Named inspection and original proof");
  await dialog
    .getByLabel(labels.files)
    .setInputFiles({ name: "inspection.png", mimeType: "image/png", buffer: PNG_BYTES });
  await dialog
    .getByRole("button", {
      name: labels.upload,
    })
    .click();
  await expect(dialog.getByText(labels.verified)).toBeVisible();
  await dialog.getByRole("button", { name: labels.clear }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: labels.refresh })).toBeFocused();
  await expect(page.getByText(labels.overdue)).toBeVisible();
  expect(fleet.record.is_blocked).toBe(true);
  expect(fleet.writes.filter((path) => path.endsWith("/clear-fault/"))).toHaveLength(1);
  await page.getByText(labels.proof, { exact: true }).click();
  await expect(
    page.getByText("Named inspection and original proof", { exact: true }),
  ).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: labels.download }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(UPLOAD_ID);
}
async function exerciseRecordWrites(page: Page, cell: LocaleCell, fleet: FleetMock) {
  const en = cell.language === "en";
  await exerciseService(page, cell, fleet);
  await recordTab(page, en ? "Services" : "Servicios").click();
  await expect(page.getByRole("table", { name: en ? "Services" : "Servicios" })).toBeVisible();
  await recordTab(page, en ? "Responsibility letters" : "Responsivas").click();
  await expect(
    page.getByRole("table", { name: en ? "Responsibility letters" : "Responsivas" }),
  ).toBeVisible();
  await expect(page.getByText(LETTER.document_reference ?? "")).toBeVisible();
  await expect(page.getByRole("link", { name: LETTER.document_reference ?? "" })).toHaveCount(0);
  await exerciseClearance(page, cell, fleet);
  expect(new URL(page.url()).searchParams.get("is_blocked")).toBe("true");
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
}

for (const language of LANGUAGES) {
  for (const theme of THEMES) {
    test(`fleet keyboard journey and reflow: ${language}, ${theme}`, async ({ page }) => {
      await rememberPreferences(page, theme, language);
      await page.addInitScript((key) => {
        window.localStorage.setItem(key, "norte");
      }, STORAGE_KEYS.organization);
      await mockApi(page, {
        me: makeMe({
          permissions: [
            "motorcycle.read",
            "motorcycle.manage",
            "motorcycle.unblock",
            "motorcycle.service_clear",
            "field.upload",
          ],
          scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "none", ids: [] } },
        }),
      });
      const fleet = await installFleet(page);
      await page.setViewportSize(VIEWPORT);
      await page.goto("/fleet/motorcycles?is_blocked=true");
      const code = page.getByRole("link", { name: "M-03" });
      await expect(code).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      await code.focus();
      await page.keyboard.press("Enter");
      const unblock = page.getByRole("button", {
        name: language === "en" ? "Unblock" : "Desbloquear",
      });
      await expect(unblock).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      await unblock.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      const cancel = dialog.getByRole("button", {
        name: language === "en" ? "Cancel" : "Cancelar",
        exact: true,
      });
      const confirm = dialog.getByRole("button", {
        name: language === "en" ? "Unblock" : "Desbloquear",
        exact: true,
      });
      await expect(cancel).toBeFocused();
      await expect(dialog.getByRole("combobox")).toHaveCount(0);
      const reason = dialog.getByRole("textbox");
      await expect(reason).toHaveAttribute("required", "");
      await expect(confirm).toBeDisabled();
      // Native modality must reject background focus; browser chrome is outside the page's trap.
      await page
        .getByRole("link", {
          name: language === "en" ? "Back to motorcycles" : "Volver a motos",
          includeHidden: true,
          exact: true,
        })
        .evaluate((element) => {
          element.focus();
        });
      await expect(cancel).toBeFocused();
      expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
      await page.keyboard.press("Shift+Tab");
      await expect(reason).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(cancel).toBeFocused();
      // HTML sequential navigation may leave the final control for browser chrome; test in-page neighbors.
      await page.keyboard.press("Shift+Tab");
      await expect(reason).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(unblock).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(cancel).toBeFocused();
      await expectNoAxeViolations(page);
      await page.keyboard.press("Shift+Tab");
      await expect(reason).toBeFocused();
      await reason.fill("Repair checked and documented");
      await expect(confirm).toBeEnabled();
      await page.keyboard.press("Tab");
      await expect(cancel).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(confirm).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByText(language === "en" ? "Available" : "Disponible", { exact: true }),
      ).toBeVisible();
      await expect(unblock).toBeFocused();
      await expectNoHorizontalScroll(page);
      await recordTab(page, language === "en" ? "Fuel" : "Combustible").click();
      await expect(
        page
          .locator("p")
          .filter({ hasText: language === "en" ? /^Insufficient data$/ : /^Datos insuficientes$/ }),
      ).toBeVisible();
      expect(new URL(page.url()).searchParams.get("is_blocked")).toBe("true");
      await expectNoHorizontalScroll(page);
      await increaseFleetText(page);
      fleet.faults = [
        {
          id: FAULT_ID,
          motorcycle: RECORD.id,
          field_event: "00000000-0000-4000-8000-000000000016",
          blocked_reason: "severe_check",
          created_at: RECORD.created_at,
          created_by: null,
          is_cleared: false,
          cleared_at: null,
          clearance: null,
        },
      ];
      fleet.record = {
        ...fleet.record,
        is_blocked: true,
        blocked_reason: "severe_check",
        revision: 2,
      };
      await page
        .getByRole("button", { name: language === "en" ? "Refresh record" : "Actualizar ficha" })
        .click();
      await exerciseRecordWrites(page, { language, theme }, fleet);
    });
  }
}
