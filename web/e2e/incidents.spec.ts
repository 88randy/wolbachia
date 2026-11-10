import { expect, test } from "./fixtures/test";
import {
  THEMES,
  LANGUAGES,
  rememberPreferences,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./fixtures/a11y";
import { mockApi } from "./fixtures/mock-api";
import { makeMe } from "../src/test/fake-api";
import { ID, PROOF, event, incident } from "../src/test/incident-fixtures";
const MOBILE_WIDTH = 320;
const MOBILE_HEIGHT = 800;
const DESKTOP_WIDTH = 1280;
const DESKTOP_HEIGHT = 1800;
for (const theme of THEMES) {
  for (const language of LANGUAGES) {
    test(`W6/W7 accessible journey: ${theme}, ${language}`, async ({ page }, testInfo) => {
      const record = incident({
        action_permissions: {
          comment: true,
          reassign: false,
          change_severity: false,
          close: true,
          void: false,
        },
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
      await rememberPreferences(page, theme, language);
      await mockApi(page, {
        me: makeMe({
          permissions: ["incident.read", "incident.create", "incident.close", "field.upload"],
          scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
        }),
      });
      await page.route("**/api/v1/incident-types/**", (route) =>
        route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } }),
      );
      await page.route("**/api/v1/incidents/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === `/api/v1/incidents/${ID}/`) return route.fulfill({ json: record });
        const results = path.endsWith("/context-options/") ? [] : [record];
        return route.fulfill({
          json: { count: results.length, next: null, previous: null, results },
        });
      });
      await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
      await page.goto("/incidents");
      await expect(page.getByRole("link", { name: "I-0033", exact: true })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      await page.setViewportSize({ width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT });
      await page.screenshot({ path: testInfo.outputPath("W6.png"), fullPage: true });
      await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
      await page.getByRole("link", { name: "I-0033", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { level: 1, name: /I-0033/ })).toBeVisible();
      await expect(page.getByText("Original report", { exact: true })).toBeVisible();
      await expect(page.getByText("Escalation audit", { exact: true })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      const closeLabel = language === "es-MX" ? "Cerrar incidente" : "Close incident";
      await page
        .getByRole("textbox", {
          name: language === "es-MX" ? "Motivo de cierre" : "Closing reason",
        })
        .fill("Resolved with verified evidence");
      const close = page.getByRole("button", { name: closeLabel, exact: true });
      await close.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("button", {
          name: language === "es-MX" ? "Cancelar" : "Cancel",
          exact: true,
        }),
      ).toBeFocused();
      // Dialog appearance fades opacity; measure its settled foreground/background contrast.
      await expect(dialog).toHaveCSS("opacity", "1");
      await expectNoAxeViolations(page);
      await page.keyboard.press("Escape");
      await expect(close).toBeFocused();
      await page.setViewportSize({ width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT });
      await page.getByRole("main").evaluate((main) => {
        main.scrollTop = 0;
      });
      await page.screenshot({ path: testInfo.outputPath("W7.png"), fullPage: true });
      await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
      await page.getByRole("main").evaluate((main) => {
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent ?? "";
          if (text.trim())
            node.textContent = `${text}${text.slice(0, Math.ceil(text.length * 0.3))}`;
        }
      });
      await expectNoHorizontalScroll(page);
    });
  }
}
