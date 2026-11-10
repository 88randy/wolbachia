import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/test";
import {
  installTransferApi,
  TRANSFER_ID,
  TRANSFER_LINE,
  TRANSFER_CODE,
  DISCREPANCY_CODE,
} from "./fixtures/transfer-mock";
import {
  LANGUAGES,
  THEMES,
  rememberPreferences,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./fixtures/a11y";

const PHONE = { width: 320, height: 700 };
const IMAGE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7V8AAAAASUVORK5CYII=",
  "base64",
);

async function verifyEvidence(page: Page, label: string | RegExp) {
  const input = page.getByLabel(label);
  await input.setInputFiles({ name: "synthetic-proof.png", mimeType: "image/png", buffer: IMAGE });
  const section = input.locator("xpath=ancestor::fieldset[1]");
  await section.getByRole("button", { name: "Verificar imagen", exact: true }).click();
  await expect(
    section.getByText("Imagen verificada por el servidor", { exact: true }),
  ).toBeVisible();
}

test("R1 W12–W14: signed dispatch, missing receipt evidence, scanner focus and discrepancy resolution", async ({
  page,
}) => {
  await rememberPreferences(page, "light", "es-MX");
  const server = await installTransferApi(page, { isPrepared: true });
  await page.goto("/inventory/transfers");
  await page.getByRole("link", { name: TRANSFER_CODE, exact: true }).click();
  const dispatch = page.getByRole("button", { name: "Firmar y despachar", exact: true });
  await expect(dispatch).toBeDisabled();
  await verifyEvidence(page, "Firma de quien entrega");
  await dispatch.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Guardado en el servidor · revisión 2", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Transferencias", exact: true }).click();
  await page.getByRole("link", { name: TRANSFER_CODE, exact: true }).click();
  const scanner = page.getByRole("textbox", {
    name: "Escanear identidad del manifiesto",
    exact: true,
  });
  await expect(scanner).toBeVisible();
  const commit = page.getByRole("button", { name: "Firmar recepción", exact: true });
  await expect(commit).toBeDisabled();
  await page.getByRole("textbox", { name: "Cantidad escaneada", exact: true }).fill("1");
  await scanner.fill(TRANSFER_LINE);
  await scanner.press("Enter");
  await expect(scanner).toBeFocused();
  await verifyEvidence(page, /^Foto del faltante:/);
  await verifyEvidence(page, "Firma de recibido");
  await page.locator("main").evaluate((main) => {
    main.scrollTo(0, 0);
  });
  const screenshot = test.info().outputPath("152-reception-light.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await test.info().attach("152-reception-light", { path: screenshot, contentType: "image/png" });
  await expect(commit).toBeEnabled();
  await commit.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Guardado en el servidor · revisión 3", { exact: true }),
  ).toBeVisible();
  await expect(scanner).toBeFocused();
  const receipt = server.writes.filter((write) => write.path.endsWith("/receive/"));
  expect(receipt).toHaveLength(1);
  expect(receipt[0]).toMatchObject({
    method: "POST",
    csrf: "e2e-csrf",
    organization: "norte",
    body: {
      expected_revision: 2,
      command_id: expect.any(String),
      signature_upload_id: expect.any(String),
      scanned: [
        {
          kind: "expected",
          line_id: TRANSFER_LINE,
          quantity: "1",
          scan_id: expect.any(String),
        },
      ],
      missing: [{ line_id: TRANSFER_LINE, quantity: "1", evidence_ids: [expect.any(String)] }],
      evidence_ids: [expect.any(String)],
    },
  });
  expect(server.writes.filter((write) => write.method === "PUT")).toHaveLength(3);
  expect(server.writes.filter((write) => write.path.endsWith("/dispatch/"))).toEqual([
    expect.objectContaining({
      method: "POST",
      csrf: "e2e-csrf",
      organization: "norte",
      body: {
        expected_revision: 1,
        signature_upload_id: expect.any(String),
        command_id: expect.any(String),
      },
    }),
  ]);
  await page.getByRole("link", { name: "Ver discrepancias", exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/inventory/discrepancies" &&
      url.searchParams.get("transfer") === TRANSFER_ID,
  );
  await page.getByRole("link", { name: DISCREPANCY_CODE, exact: true }).click();
  await expect(page.getByRole("heading", { name: DISCREPANCY_CODE, exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Cómo se resolvió esta línea", exact: true })
    .selectOption("ack_missing");
  await page
    .getByRole("textbox", { name: "Motivo de la resolución", exact: true })
    .fill("Synthetic warehouse confirmation of missing material");
  await page.getByRole("button", { name: "Revisar y cerrar discrepancia", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Confirmar resolución", exact: true }).click();
  await expect(
    page.getByText("Resolución registrada en el servidor", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Cerrada", { exact: true })).toBeVisible();
  await expect(page.getByText(/Bloqueo resuelto por esta discrepancia/)).toBeVisible();
  const close = server.writes.filter((write) => write.path.endsWith("/close/"));
  expect(close).toHaveLength(1);
  expect(close[0]).toMatchObject({
    method: "POST",
    csrf: "e2e-csrf",
    organization: "norte",
    body: {
      expected_revision: 0,
      reason: "Synthetic warehouse confirmation of missing material",
      evidence_ids: [],
      resolution: {
        outcomes: [
          { line_id: "15200000-0000-4000-8000-000000000009", kind: "ack_missing", quantity: "1" },
        ],
      },
    },
  });
  expect(close[0]?.body).not.toHaveProperty("command_id");
  expect(server.reads.some((url) => new URL(url).searchParams.get("code") === TRANSFER_CODE)).toBe(
    true,
  );
  expect(
    server.reads.some((url) => new URL(url).searchParams.get("code") === DISCREPANCY_CODE),
  ).toBe(true);
  expect(
    server.reads.some(
      (url) =>
        new URL(url).pathname === "/api/v1/discrepancies/" &&
        new URL(url).searchParams.get("transfer") === TRANSFER_ID,
    ),
  ).toBe(true);
});

async function increaseText(page: Page) {
  await page.evaluate(() => {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    for (const name of Array.from(computed).filter(
      (key) => key.startsWith("--web-type-") && key.endsWith("-font-size"),
    ))
      root.style.setProperty(
        name,
        String(Number.parseFloat(computed.getPropertyValue(name)) * 1.3) + "px",
      );
  });
}
async function expectContainedControls(page: Page) {
  const overflowing = await page
    .locator("main input, main select, main textarea, main button")
    .evaluateAll((controls) =>
      controls
        .filter((control) => {
          if (control.closest("table")) return false;
          const main = control.closest("main")?.getBoundingClientRect();
          const box = control.getBoundingClientRect();
          return main && box.width > 0 && (box.left < main.left || box.right > main.right);
        })
        .map((control) => control.outerHTML),
    );
  expect(overflowing).toEqual([]);
}
function luminance(color: string) {
  const channels = color
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map((channel) => {
      const value = Number(channel) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
  if (!channels || channels.length !== 3) throw new Error("Expected an RGB focus color: " + color);
  const [red = 0, green = 0, blue = 0] = channels;
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}
function contrast(first: string, second: string) {
  const left = luminance(first);
  const right = luminance(second);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}
async function expectScannerKeyboard(page: Page, language: string) {
  const scanner = page.getByRole("textbox", {
    name: language === "en" ? "Scan manifest identity" : "Escanear identidad del manifiesto",
    exact: true,
  });
  await scanner.focus();
  await expect(scanner).toBeFocused();
  const colors = await scanner.evaluate((input) => {
    const field = input.parentElement;
    if (!field) throw new Error("Missing scanner field boundary");
    const style = getComputedStyle(field);
    return {
      foreground: getComputedStyle(input).color,
      surface: style.backgroundColor,
      ring: style.outlineColor,
      ringStyle: style.outlineStyle,
      ringWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(colors.ringStyle).toBe("solid");
  expect(colors.ringWidth).toBeGreaterThan(0);
  expect(contrast(colors.foreground, colors.surface)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.ring, colors.surface)).toBeGreaterThanOrEqual(3);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("textbox", {
      name: language === "en" ? "Scanned quantity" : "Cantidad escaneada",
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(scanner).toBeFocused();
}
async function expectResolutionKeyboard(page: Page, language: string) {
  await page
    .getByRole("combobox", {
      name: language === "en" ? "How this line was resolved" : "Cómo se resolvió esta línea",
      exact: true,
    })
    .selectOption("ack_missing");
  await page
    .getByRole("textbox", {
      name: language === "en" ? "Resolution reason" : "Motivo de la resolución",
      exact: true,
    })
    .fill("Synthetic documented warehouse discrepancy resolution");
  const trigger = page.getByRole("button", {
    name: language === "en" ? "Review and close discrepancy" : "Revisar y cerrar discrepancia",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", {
      name: language === "en" ? "Cancel" : "Cancelar",
      exact: true,
    }),
  ).toBeFocused();
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
}
async function auditPage(page: Page, context: { path: string; language: string; theme: string }) {
  await page.goto(context.path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await increaseText(page);
  await expectNoHorizontalScroll(page);
  await expectContainedControls(page);
  if (context.path.endsWith(TRANSFER_CODE)) await expectScannerKeyboard(page, context.language);
  if (context.path.endsWith(DISCREPANCY_CODE))
    await expectResolutionKeyboard(page, context.language);
  await expectNoAxeViolations(page);
  const name = `152-${context.language}-${context.theme}-${context.path.split("/").at(-1) ?? "list"}-320`;
  await page.locator("main").evaluate((main) => {
    main.scrollTo(0, 0);
  });
  const path = test.info().outputPath(name + ".png");
  await page.screenshot({ path, fullPage: true });
  await test.info().attach(name, { path, contentType: "image/png" });
}
for (const language of LANGUAGES) {
  for (const theme of THEMES) {
    test(`W12–W14 accessibility and 320px reflow: ${language}, ${theme}`, async ({ page }) => {
      await rememberPreferences(page, theme, language);
      const server = await installTransferApi(page);
      await page.setViewportSize(PHONE);
      for (const path of ["/inventory/transfers", `/inventory/transfers/${TRANSFER_CODE}`])
        await auditPage(page, { path, language, theme });
      server.receiveFixture();
      for (const path of [
        "/inventory/discrepancies",
        `/inventory/discrepancies/${DISCREPANCY_CODE}`,
      ])
        await auditPage(page, { path, language, theme });
    });
  }
}
