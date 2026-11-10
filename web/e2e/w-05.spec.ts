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
import {
  mockPeopleJourney,
  SUBJECT_ID,
  CENTER_ID,
  TRAINING_VERSION_ID,
  EVIDENCE_ID,
  OLD_EVALUATION_ID,
  OLD_RUBRIC_VERSION,
  RUBRIC_VERSION,
  RUBRIC_CODE,
  CLOCK,
  EXPIRY,
} from "./w-05-api";

const PHONE = { width: 320, height: 800 };
const DESKTOP = { width: 1280, height: 1000 };

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
}

for (const theme of THEMES) {
  for (const language of LANGUAGES) {
    test(`W50/W51 certification, pinned evaluation history and truthful notice: ${theme}, ${language}`, async ({
      page,
    }, testInfo) => {
      const copy = messages[language];
      await rememberPreferences(page, theme, language);
      const server = await mockPeopleJourney(page);
      await page.setViewportSize(PHONE);
      await page.goto(
        `/people/trainings?subject=${SUBJECT_ID}&center=${CENTER_ID}&action=release.record`,
      );
      await expect(
        page.getByRole("heading", { name: copy["trainings.workspace.title"], exact: true }),
      ).toBeVisible();
      const certificateTrigger = page.getByRole("button", {
        name: copy["trainings.person.create"],
        exact: true,
      });
      await certificateTrigger.focus();
      await page.keyboard.press("Enter");
      const certificateDialog = page.getByRole("dialog", {
        name: copy["trainings.person.create"],
        exact: true,
      });
      await expect(certificateDialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(certificateTrigger).toBeFocused();
      await page.keyboard.press("Enter");
      await certificateDialog
        .getByRole("textbox", { name: copy["trainings.field.trainingVersion"], exact: true })
        .fill(TRAINING_VERSION_ID);
      await certificateDialog
        .getByRole("button", { name: copy["trainings.person.create"], exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await expect(certificateDialog.getByRole("alert")).toBeVisible();
      await expect(certificateDialog.getByRole("alert")).toBeFocused();
      await expect(
        certificateDialog.getByRole("textbox", {
          name: copy["trainings.field.trainingVersion"],
          exact: true,
        }),
      ).toHaveValue(TRAINING_VERSION_ID);
      const certificateFields = [
        ["trainings.field.validFrom", CLOCK],
        ["trainings.field.validTo", EXPIRY],
        ["trainings.field.evidence", EVIDENCE_ID],
        ["trainings.field.issuer", "Synthetic issuer reference"],
        ["trainings.field.attestation", "Synthetic verified certification evidence"],
      ] as const;
      for (const [key, value] of certificateFields)
        await certificateDialog.getByRole("textbox", { name: copy[key], exact: true }).fill(value);
      await expectNoAxeViolations(page);
      const certificateSubmit = certificateDialog.getByRole("button", {
        name: copy["trainings.person.create"],
        exact: true,
      });
      await certificateSubmit.focus();
      await page.keyboard.press("Enter");
      await expect(
        certificateDialog
          .locator('[aria-live="polite"]')
          .filter({ hasText: copy["trainings.form.saved"] }),
      ).toContainText(copy["trainings.form.saved"]);
      expect(server.commands[0]?.body).toMatchObject({
        expected_revision: 0,
        center: CENTER_ID,
        quadrant: null,
        training_version: TRAINING_VERSION_ID,
        valid_from: CLOCK,
        valid_to: EXPIRY,
        evidence_ids: [EVIDENCE_ID],
      });
      await page.keyboard.press("Escape");
      await expect(certificateTrigger).toBeFocused();
      await expect(
        page.getByText(copy["trainings.eligibility.eligible"], { exact: true }),
      ).toBeVisible();
      await expectNoAxeViolations(page);
      await page.setViewportSize(DESKTOP);
      await page.screenshot({ path: testInfo.outputPath("W50.png"), fullPage: true });
      await page.setViewportSize(PHONE);
      await expectExpandedTextReflow(page);

      await page.goto("/people/evaluations");
      await expect(
        page.getByRole("heading", { name: copy["evaluations.page.title"], exact: true }),
      ).toBeVisible();
      await page
        .getByRole("textbox", { name: copy["evaluations.rubric.code"], exact: true })
        .fill(RUBRIC_CODE);
      await page
        .getByRole("button", { name: copy["evaluations.rubric.lookup"], exact: true })
        .click();
      const versionRow = page.getByRole("row").filter({ hasText: RUBRIC_VERSION });
      await versionRow
        .getByRole("button", { name: copy["evaluations.rubric.select"], exact: true })
        .click();
      const evaluationForm = page.getByRole("region", {
        name: copy["evaluations.form.title"],
        exact: true,
      });
      await evaluationForm
        .getByRole("textbox", { name: copy["evaluations.field.subject"], exact: true })
        .fill(SUBJECT_ID);
      await evaluationForm
        .getByRole("textbox", { name: copy["evaluations.field.center"], exact: true })
        .fill(CENTER_ID);
      await evaluationForm
        .getByRole("textbox", { name: copy["evaluations.field.observed"], exact: true })
        .fill(CLOCK);
      for (const [key, value] of [
        ["evaluations.field.presentation", "80"],
        ["evaluations.field.execution", "62"],
        ["evaluations.field.coverage", "50"],
      ] as const) {
        await evaluationForm.getByRole("spinbutton", { name: copy[key], exact: true }).fill(value);
      }
      await evaluationForm
        .getByRole("combobox", { name: "safety", exact: true })
        .selectOption("true");
      const review = evaluationForm.getByRole("button", {
        name: copy["evaluations.form.review"],
        exact: true,
      });
      await review.focus();
      await page.keyboard.press("Enter");
      const evaluationDialog = page.getByRole("dialog");
      await expect(
        evaluationDialog.getByRole("button", { name: copy["common.actions.cancel"], exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(review).toBeFocused();
      await page.keyboard.press("Enter");
      await expectNoAxeViolations(page);
      await evaluationDialog
        .getByRole("button", { name: copy["evaluations.form.save"], exact: true })
        .click();
      await expect(
        evaluationForm.getByText(copy["evaluations.result.saved"], { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: copy["evaluations.result.title"], exact: true }),
      ).toContainText("62.0000");
      expect(server.commands[1]?.body).toMatchObject({
        expected_revision: 0,
        subject: SUBJECT_ID,
        center: CENTER_ID,
        quadrant: null,
        rubric_version: RUBRIC_VERSION,
        observed_at: CLOCK,
        section_scores: { presentation: "80", execution: "62", coverage: "50" },
        critical_responses: { safety: true },
      });
      const oldRow = page.getByRole("row").filter({ hasText: OLD_EVALUATION_ID });
      await oldRow.getByRole("link").filter({ hasText: copy["evaluations.history.open"] }).click();
      await expect(page).toHaveURL(new RegExp(`item=${OLD_EVALUATION_ID}`));
      await expect(page).toHaveURL(new RegExp(`rubric_code=${RUBRIC_CODE}`));
      const attempts = page.getByRole("region", {
        name: copy["evaluations.history.attempts"],
        exact: true,
      });
      await expect(attempts).toContainText("61.0000");
      await expect(attempts).toContainText("64.5000");
      await expect(page.getByText(OLD_RUBRIC_VERSION, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(copy["evaluations.notice.gap"], { exact: true })).toBeVisible();
      expect(server.commands).toHaveLength(2);
      await expectNoAxeViolations(page);
      await page.setViewportSize(DESKTOP);
      await page.screenshot({ path: testInfo.outputPath("W51.png"), fullPage: true });
      await page.setViewportSize(PHONE);
      await expectExpandedTextReflow(page);
    });
  }
}
