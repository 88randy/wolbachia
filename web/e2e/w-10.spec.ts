import type { Page } from "@playwright/test";
import { messages } from "@wolbachia/i18n";
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

type Language = (typeof LANGUAGES)[number];
const PHONE = { width: 320, height: 700 };
const IMAGE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7V8AAAAASUVORK5CYII=",
  "base64",
);

/** A photo is saved by itself as soon as it is chosen. */
async function verifyEvidence(page: Page, label: string | RegExp) {
  const input = page.getByLabel(label);
  await input.setInputFiles({ name: "synthetic-proof.png", mimeType: "image/png", buffer: IMAGE });
  const section = input.locator("xpath=ancestor::fieldset[1]");
  await expect(section.getByText("Foto guardada", { exact: true })).toBeVisible();
}

/** Draws on the signature pad with the pointer; the image is saved by itself when long enough. */
async function drawSignature(page: Page) {
  const pad = page.getByRole("img", { name: /^Firma:/ });
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  if (!box) throw new Error("The signature pad has no box");
  await page.mouse.move(box.x + 20, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 100, { steps: 8 });
  await page.mouse.move(box.x + 60, box.y + 40, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText("Firma lista", { exact: true })).toBeVisible();
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
  await drawSignature(page);
  await dispatch.focus();
  await page.keyboard.press("Enter");
  // The saved dispatch moves the record on to the reception step.
  await expect(
    page.getByRole("region", { name: "Confirmar recepción", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Volver a la lista", exact: true }).click();
  await page.getByRole("link", { name: TRANSFER_CODE, exact: true }).click();
  // Every line starts as arrived in full; the person only fixes what differs.
  const received = page.getByRole("textbox", { name: "Llegaron", exact: true });
  await expect(received).toHaveValue("2");
  const commit = page.getByRole("button", { name: "Confirmar recepción", exact: true });
  await expect(commit).toHaveAttribute("aria-disabled", "true");
  await received.fill("1");
  await verifyEvidence(page, /^Foto de lo que faltó:/);
  await drawSignature(page);
  await page.locator("main").evaluate((main) => {
    main.scrollTo(0, 0);
  });
  const screenshot = test.info().outputPath("152-reception-light.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await test.info().attach("152-reception-light", { path: screenshot, contentType: "image/png" });
  await expect(commit).not.toHaveAttribute("aria-disabled", "true");
  await commit.focus();
  await page.keyboard.press("Enter");
  // The saved reception turns the record into "Con diferencia" and links to the difference.
  await expect(page.getByRole("link", { name: "Ver la diferencia", exact: true })).toBeVisible();
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
  await page.getByRole("link", { name: "Ver la diferencia", exact: true }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/inventory/discrepancies" &&
      url.searchParams.get("transfer") === TRANSFER_ID,
  );
  await page.getByRole("link", { name: DISCREPANCY_CODE, exact: true }).click();
  await expect(page.getByRole("heading", { name: DISCREPANCY_CODE, exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "¿Cómo se resolvió?", exact: true }).click();
  await page.getByRole("option", { name: "Dar por perdido", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Motivo de la resolución", exact: true })
    .fill("Synthetic warehouse confirmation of missing material");
  await page.getByRole("button", { name: "Resolver", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Sí, resolver", exact: true }).click();
  await expect(page.getByText("Resolución registrada", { exact: true })).toBeVisible();
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
async function expectScannerKeyboard(page: Page, language: Language) {
  // The scanner is for pieces that were not on the list, so it sits in a disclosure.
  const extras = page.getByRole("button", {
    name: messages[language]["transfers.receive.extras"],
    exact: true,
  });
  await extras.focus();
  await page.keyboard.press("Enter");
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
  // The camera button (only on devices with a camera) sits between the field and the quantity.
  const camera = page.getByRole("button", { name: messages[language]["scan.camera.open"] });
  const skipCamera = async (key: "Tab" | "Shift+Tab") => {
    await page.keyboard.press(key);
    const isOnCamera =
      (await camera.count()) > 0 && (await camera.evaluate((el) => el === document.activeElement));
    if (isOnCamera) await page.keyboard.press(key);
  };
  await skipCamera("Tab");
  await expect(
    page.getByRole("textbox", { name: messages[language]["transfers.scan.quantity"], exact: true }),
  ).toBeFocused();
  await skipCamera("Shift+Tab");
  await expect(scanner).toBeFocused();
}
async function expectResolutionKeyboard(page: Page, language: Language) {
  await page
    .getByRole("combobox", { name: messages[language]["discrepancies.close.outcome"], exact: true })
    .click();
  await page
    .getByRole("option", {
      name: messages[language]["discrepancies.outcome.ackMissing"],
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", {
      name: language === "en" ? "Resolution reason" : "Motivo de la resolución",
      exact: true,
    })
    .fill("Synthetic documented warehouse discrepancy resolution");
  const trigger = page.getByRole("button", {
    name: messages[language]["discrepancies.close.action"],
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
async function auditPage(page: Page, context: { path: string; language: Language; theme: string }) {
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
