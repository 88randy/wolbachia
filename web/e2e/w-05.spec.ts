import type { Locator, Page } from "@playwright/test";
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
  RUBRIC_VERSION,
  RUBRIC_CODE,
  CLOCK,
  PNG_BYTES,
  SUBJECT_NAME,
  CENTER_NAME,
} from "./w-05-api";

// Calendar days of the certificate (organization zone is America/Mexico_City, UTC-6 in November).
const VALID_FROM_DAY = "2026-11-09";
const VALID_TO_DAY = "2026-11-30";
const OBSERVED_DAY = "2026-11-09";
const PHONE = { width: 320, height: 800 };
const DESKTOP = { width: 1280, height: 1000 };

/** Opens a searchable picker, types part of the name and confirms the first match with Enter. */
async function pickByName(page: Page, picker: Locator, name: string) {
  await picker.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name })).toBeVisible();
  await page.keyboard.type(name);
  await expect(page.getByRole("option", { name, selected: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(picker).toContainText(name);
  // Focus returns to the trigger once the list is gone; only then is the next control safe to use.
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(picker).toBeFocused();
}

/** Picks a calendar day with the keyboard from the open date popover, then waits for it to close. */
async function pickDay(page: Page, day: string) {
  const button = page.locator(`[data-day="${day}"] button`);
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-day]")).toHaveCount(0);
}

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
      // The calendars open on the current month: pin it so the picked days exist.
      await page.clock.setFixedTime(new Date(CLOCK));
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
      // The course version is picked by name from a searchable list; no id is typed.
      const versionPicker = certificateDialog.getByRole("combobox", {
        name: copy["trainings.field.trainingVersion"],
        exact: true,
      });
      await pickByName(page, versionPicker, "Synthetic field safety");
      await certificateDialog
        .getByRole("button", { name: copy["trainings.person.create"], exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await expect(certificateDialog.getByRole("alert")).toBeVisible();
      await expect(certificateDialog.getByRole("alert")).toBeFocused();
      await expect(versionPicker).toContainText("Synthetic field safety");
      for (const [key, day] of [
        ["trainings.field.validFrom", VALID_FROM_DAY],
        ["trainings.field.validTo", VALID_TO_DAY],
      ] as const) {
        await certificateDialog.getByRole("button", { name: copy[key], exact: true }).click();
        await pickDay(page, day);
      }
      for (const [key, value] of [
        ["trainings.field.issuer", "Synthetic issuer reference"],
        ["trainings.field.attestation", "Synthetic verified certification evidence"],
      ] as const)
        await certificateDialog.getByRole("textbox", { name: copy[key], exact: true }).fill(value);
      // The evidence image is uploaded and verified before the certification is recorded.
      await certificateDialog
        .getByLabel(copy["trainings.evidence.file"], { exact: true })
        .setInputFiles({ name: "certificate.png", mimeType: "image/png", buffer: PNG_BYTES });
      await certificateDialog
        .getByRole("button", { name: copy["trainings.evidence.upload"], exact: true })
        .click();
      await expect(
        certificateDialog.getByText(copy["trainings.evidence.verified"], { exact: true }),
      ).toBeVisible();
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
        valid_from: "2026-11-09T06:00:00.000Z",
        valid_to: "2026-12-01T05:59:00.000Z",
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
      // The rubric, person, center and day are all picked from lists and a calendar.
      const rubricPicker = page.getByRole("combobox", {
        name: copy["evaluations.rubric.code"],
        exact: true,
      });
      await pickByName(page, rubricPicker, "Synthetic field observation");
      // Versions are listed by number (the published one is 2), never by id.
      const versionRow = page
        .getByRole("row")
        .filter({ has: page.getByRole("definition").getByText("2", { exact: true }) });
      await versionRow
        .getByRole("button", { name: copy["evaluations.rubric.select"], exact: true })
        .click();
      const evaluationForm = page.getByRole("region", {
        name: copy["evaluations.form.title"],
        exact: true,
      });
      for (const [key, option] of [
        ["evaluations.field.subject", SUBJECT_NAME],
        ["evaluations.field.center", CENTER_NAME],
      ] as const) {
        await pickByName(
          page,
          evaluationForm.getByRole("combobox", { name: copy[key], exact: true }),
          option,
        );
      }
      await evaluationForm
        .getByRole("button", { name: copy["evaluations.field.observed"], exact: true })
        .click();
      await pickDay(page, OBSERVED_DAY);
      for (const [key, value] of [
        ["evaluations.field.presentation", "80"],
        ["evaluations.field.execution", "62"],
        ["evaluations.field.coverage", "50"],
      ] as const) {
        await evaluationForm.getByRole("spinbutton", { name: copy[key], exact: true }).fill(value);
      }
      await evaluationForm.getByRole("combobox", { name: "safety", exact: true }).click();
      await page.getByRole("option", { name: copy["evaluations.field.yes"], exact: true }).click();
      const review = evaluationForm.getByRole("button", {
        name: copy["evaluations.form.review"],
        exact: true,
      });
      await expect(review).not.toHaveAttribute("aria-disabled", "true");
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
        observed_at: "2026-11-09T14:00:00.000Z",
        section_scores: { presentation: "80", execution: "62", coverage: "50" },
        critical_responses: { safety: true },
      });
      await page.getByRole("tab", { name: copy["evaluations.tab.history"], exact: true }).click();
      // History rows show person, outcome and score, not ids; the old evaluation scores 64.5.
      const oldRow = page.getByRole("row").filter({ hasText: "64.5000" });
      await oldRow.getByRole("link").filter({ hasText: copy["evaluations.history.open"] }).click();
      await expect(page).toHaveURL(new RegExp(`item=${OLD_EVALUATION_ID}`));
      await expect(page).toHaveURL(new RegExp(`rubric_code=${RUBRIC_CODE}`));
      const attempts = page.getByRole("region", {
        name: copy["evaluations.history.attempts"],
        exact: true,
      });
      await expect(attempts).toContainText("61.0000");
      await expect(attempts).toContainText("64.5000");
      // The attempt keeps its correction reason; the pinned rubric version id is not shown now.
      await expect(attempts).toContainText("Synthetic retained correction reason");
      // The truthful notice (no HR delivery receipt) lives in its own tab.
      await page.getByRole("tab", { name: copy["evaluations.tab.notice"], exact: true }).click();
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
