import type { Page } from "@playwright/test";
import { messages } from "@wolbachia/i18n";
import { expect, test } from "./fixtures/test";
import {
  THEMES,
  LANGUAGES,
  rememberPreferences,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./fixtures/a11y";
import { mockReviewJourney, REVIEW_ID, APPROVE_ID, REJECT_ID, TASK_CODE } from "./w-19-api";

const PHONE = { width: 320, height: 800 };
const DESKTOP = { width: 1280, height: 1000 };
const REVIEW_REASON = "Original evidence verified by authorized reviewer";
const APPROVE_REASON = "Approved the proposed location with retained point identity";
const REJECT_REASON = "Access remains blocked; return to the original point tomorrow";

async function expectExpandedTextReflow(page: Page) {
  await expectNoHorizontalScroll(page);
  await page.locator('main, [role="dialog"]').evaluateAll((surfaces) => {
    surfaces.forEach((surface) => {
      const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        if (text.trim()) node.textContent = `${text}${text.slice(0, Math.ceil(text.length * 0.3))}`;
      }
    });
  });
  await expectNoHorizontalScroll(page);
  const sheet = page.getByRole("dialog");
  if (await sheet.isVisible()) {
    expect(await sheet.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
  }
}

for (const theme of THEMES) {
  for (const language of LANGUAGES) {
    test(`R7 review, relocation and closure: ${theme}, ${language}`, async ({ page }, testInfo) => {
      const copy = messages[language];
      await rememberPreferences(page, theme, language);
      const server = await mockReviewJourney(page);
      await page.setViewportSize(PHONE);
      await page.goto("/operations/reviews");
      const reviewLink = page.getByRole("link", {
        name: copy["reviews.workspace.open"].replace("{id}", REVIEW_ID),
        exact: true,
      });
      await reviewLink.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("heading", { name: copy["reviews.workspace.detail"], exact: true }),
      ).toBeVisible();
      await page
        .getByRole("textbox", { name: copy["reviews.workspace.reason"], exact: true })
        .fill(REVIEW_REASON);
      const accept = page.getByRole("button", {
        name: copy["reviews.workspace.accept"],
        exact: true,
      });
      await accept.focus();
      await page.keyboard.press("Enter");
      const reviewDialog = page.getByRole("dialog");
      await expect(reviewDialog).toBeVisible();
      await expect(
        reviewDialog.getByRole("button", { name: copy["common.actions.cancel"], exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(accept).toBeFocused();
      await page.keyboard.press("Enter");
      await reviewDialog
        .getByRole("button", { name: copy["reviews.workspace.accept"], exact: true })
        .click();
      await expect(
        page.getByRole("region", { name: copy["reviews.workspace.history"] }),
      ).toContainText(REVIEW_REASON);
      expect(server.commands[0]).toEqual({
        path: `/api/v1/review-items/${REVIEW_ID}/accept/`,
        body: { expected_revision: 0, reason: REVIEW_REASON },
      });
      await expectNoAxeViolations(page);
      await page.setViewportSize(DESKTOP);
      await page.getByRole("main").evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.screenshot({ path: testInfo.outputPath("W30.png"), fullPage: true });
      await page.setViewportSize(PHONE);
      await expectExpandedTextReflow(page);

      await page.goto("/operations/relocations");
      const approveLink = page.getByRole("link", { name: "P-160-A", exact: true });
      await approveLink.focus();
      await page.keyboard.press("Enter");
      let sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText("P-160-A");
      await expect(sheet).toContainText(
        language === "en" ? "Restricted access" : "Acceso restringido",
      );
      await sheet
        .getByRole("textbox", { name: copy["relocations.workspace.decisionReason"] })
        .fill(APPROVE_REASON);
      await sheet
        .getByRole("button", { name: copy["relocations.workspace.approve"], exact: true })
        .click();
      await expect(sheet.locator('section[role="status"]')).toContainText(APPROVE_REASON);
      await page.keyboard.press("Escape");
      await expect(sheet).not.toBeVisible();
      const rejectLink = page.getByRole("link", { name: "P-160-B", exact: true });
      await rejectLink.focus();
      await page.keyboard.press("Enter");
      sheet = page.getByRole("dialog");
      await expect(sheet).toContainText("P-160-B");
      await sheet
        .getByRole("textbox", { name: copy["relocations.workspace.decisionReason"] })
        .fill(REJECT_REASON);
      await sheet
        .getByRole("button", { name: copy["relocations.workspace.reject"], exact: true })
        .click();
      await expect(sheet.locator('section[role="status"]')).toContainText(TASK_CODE);
      await expect(sheet.locator('section[role="status"]')).toContainText("2026-11-10");
      expect(server.commands.slice(1)).toEqual([
        {
          path: `/api/v1/relocations/${APPROVE_ID}/approve/`,
          body: { expected_revision: 0, reason: APPROVE_REASON },
        },
        {
          path: `/api/v1/relocations/${REJECT_ID}/reject/`,
          body: { expected_revision: 0, reason: REJECT_REASON },
        },
      ]);
      await expectNoAxeViolations(page);
      await page.setViewportSize(DESKTOP);
      await page.screenshot({ path: testInfo.outputPath("W31.png"), fullPage: true });
      await page.setViewportSize(PHONE);
      await expectExpandedTextReflow(page);

      await page.goto("/quadrants/Q-160/closure");
      await expect(
        page.getByRole("heading", {
          name: copy["closure.page.title"].replace("{code}", "Q-160"),
          exact: true,
        }),
      ).toBeVisible();
      const blockers = page.getByRole("region", {
        name: copy["closure.blocker.title"],
        exact: true,
      });
      await expect(blockers.getByRole("listitem")).toHaveCount(2);
      await expect(blockers).toContainText(copy["closure.blocker.removalUnconfirmed"]);
      await expect(blockers).toContainText(copy["closure.blocker.removalUnrecovered"]);
      const close = page.getByRole("button", { name: copy["closure.actions.close"], exact: true });
      await expect(close).toHaveAttribute("aria-disabled", "true");
      await expectNoAxeViolations(page);
      server.resolvePhysicalBlockers();
      await page
        .getByRole("button", { name: copy["closure.actions.refresh"], exact: true })
        .click();
      await expect(close).toHaveAttribute("aria-disabled", "false");
      await close.focus();
      await page.keyboard.press("Enter");
      const closeDialog = page.getByRole("dialog");
      await expect(
        closeDialog.getByRole("button", { name: copy["common.actions.cancel"], exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(close).toBeFocused();
      await page.keyboard.press("Enter");
      await closeDialog
        .getByRole("button", { name: copy["closure.actions.confirm"], exact: true })
        .click();
      await expect(page.getByText(copy["closure.readiness.closed"], { exact: true })).toBeVisible();
      expect(server.commands.at(-1)).toMatchObject({ body: { expected_revision: 3 } });
      expect(server.commands).toHaveLength(4);
      await expectNoAxeViolations(page);
      await page.setViewportSize(DESKTOP);
      await page.screenshot({ path: testInfo.outputPath("W33.png"), fullPage: true });
      await page.setViewportSize(PHONE);
      await expectExpandedTextReflow(page);
    });
  }
}
