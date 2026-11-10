import type { Locator, Page } from "@playwright/test";
import type { Schemas } from "@wolbachia/api-client";
import { messages } from "@wolbachia/i18n";
import type { Locale } from "@wolbachia/i18n";
import { makeMe } from "../src/test/fake-api";
import { expect, test } from "./fixtures/test";
import { mockApi } from "./fixtures/mock-api";
import {
  LANGUAGES,
  THEMES,
  rememberPreferences,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./fixtures/a11y";

type Shift = Schemas["ShiftDetail"];
type Decision = Schemas["ShiftDecision"];
type DecisionKind = Schemas["ShiftValidationKindEnum"];
const SHIFT_ID = "00000000-0000-4000-8000-000000000034";
const SHIFT_PATH = `/operations/shifts/${SHIFT_ID}`;
const DETAIL_PATH = `/api/v1/shifts/${SHIFT_ID}/`;
const DESKTOP = { width: 1280, height: 1000 };
const COMPACT = { width: 320, height: 800 };
const APPROVAL_REASON = "Reviewed the available synthetic shift facts";
const OBSERVATION_REASON = "Please review the synthetic closing note";
const REVISED_REASON = "Please clarify the documented synthetic closing note";
const REVIEWER = makeMe({
  permissions: ["shift.read", "shift.validate"],
  scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
});

/** Only facts already exposed by ShiftDetail; no map, names or visit totals are synthesized. */
function closedShift(): Shift {
  return {
    id: SHIFT_ID,
    courier: "00000000-0000-4000-8000-000000000001",
    device: "00000000-0000-4000-8000-000000000002",
    motorcycle: "00000000-0000-4000-8000-000000000003",
    motorcycle_code: "M-03",
    status: "closed",
    opened_at_device: "2026-11-03T14:12:00Z",
    opened_event: "00000000-0000-4000-8000-000000000004",
    odometer_open_km: 12480,
    open_note: "Synthetic opening",
    closed_at_device: "2026-11-03T20:40:00Z",
    closed_event: "00000000-0000-4000-8000-000000000005",
    odometer_close_km: 12521,
    close_note: "Synthetic closing",
    checks: [],
    created_at: "2026-11-03T14:13:00Z",
    validation: {
      revision: 0,
      kind: null,
      latest_decision: null,
      approval_current: false,
      blockers: [],
    },
    validation_timeline: [],
  };
}

function savedDecision(
  shift: Shift,
  kind: DecisionKind,
  body: Schemas["ShiftDecisionRequestRequest"],
): Decision {
  const revision = shift.validation.revision + 1;
  return {
    id: `00000000-0000-4000-8000-${String(revision + 10).padStart(12, "0")}`,
    shift: shift.id,
    closed_event: shift.closed_event ?? "",
    kind,
    revision,
    expected_revision: body.expected_revision,
    reason: body.reason,
    validation_fingerprint: "synthetic-browser-frame",
    subjects: [],
    created_by: REVIEWER.user.id,
    created_at: "2026-11-04T15:00:00Z",
  };
}

function withDecision(shift: Shift, decision: Decision): Shift {
  return {
    ...shift,
    validation: {
      revision: decision.revision,
      kind: decision.kind,
      latest_decision: decision.id,
      approval_current: decision.kind === "approve",
      blockers: [],
    },
    validation_timeline: [...shift.validation_timeline, decision],
  };
}

/** The existing attested route fixture supplies the same session header as the API. */
async function installShifts(page: Page) {
  let shift = closedShift();
  let hasRejectedObservation = false;
  await page.route("**/api/v1/shifts/**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET" && ["/api/v1/shifts/", DETAIL_PATH].includes(path)) {
      const json =
        path === DETAIL_PATH ? shift : { count: 1, next: null, previous: null, results: [shift] };
      return route.fulfill({ json });
    }
    if (
      request.method() !== "POST" ||
      ![`${DETAIL_PATH}approve/`, `${DETAIL_PATH}observe/`].includes(path)
    )
      return route.fulfill({
        status: 404,
        json: { code: "not_found", detail: "Unknown synthetic route" },
      });
    const kind = path.endsWith("/approve/") ? "approve" : "observe";
    if (kind === "observe" && !hasRejectedObservation) {
      hasRejectedObservation = true;
      return route.fulfill({
        status: 400,
        json: {
          code: "validation_error",
          detail: "Synthetic reason rejection",
          fields: { reason: [{ code: "void_reason_too_short", params: { min_length: 10 } }] },
        },
      });
    }
    const body = request.postDataJSON() as Schemas["ShiftDecisionRequestRequest"];
    const decision = savedDecision(shift, kind, body);
    shift = withDecision(shift, decision);
    return route.fulfill({ status: 201, json: decision });
  });
}

async function openDecision(page: Page, language: Locale, kind: DecisionKind) {
  const copy = messages[language];
  const label = copy[kind === "approve" ? "shift.action.approve" : "shift.action.observe"];
  const trigger = page.getByRole("button", { name: label, exact: true });
  await expect(trigger).toHaveAttribute("aria-disabled", "false");
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: copy["common.actions.cancel"], exact: true }),
  ).toBeFocused();
  return { trigger, dialog, submit: dialog.getByRole("button", { name: label, exact: true }) };
}

async function checkFocusTrap(page: Page, dialog: Locator, language: Locale) {
  const close = dialog.getByRole("button", {
    name: messages[language]["common.actions.close"],
    exact: true,
  });
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("textbox")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: messages[language]["shift.action.observe"], exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
}

async function expectRegionFits(region: Locator) {
  await expect
    .poll(() => region.evaluate((element) => element.scrollWidth - element.clientWidth))
    .toBe(0);
}

/** Exercise text expansion independently of whichever translations happen to be longest today. */
async function expandText(region: Locator) {
  await region.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      if (text.trim()) node.textContent = `${text}${text.slice(0, Math.ceil(text.length * 0.3))}`;
    }
  });
}

const variants = THEMES.flatMap((theme) => LANGUAGES.map((language) => ({ theme, language })));
for (const { theme, language } of variants) {
  test(`W29 keyboard decisions and reflow: ${theme}, ${language}`, async ({ page }, testInfo) => {
    const copy = messages[language];
    await rememberPreferences(page, theme, language);
    await mockApi(page, { me: REVIEWER });
    await installShifts(page);
    await page.setViewportSize(COMPACT);
    await page.goto("/operations/shifts?status=closed");
    const row = page.getByRole("table").getByRole("link");
    await expect(row).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(SHIFT_PATH);
    await expect(
      page.getByRole("heading", { name: copy["shift.page.summary"], exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: copy["shift.page.timeline"] }).getByRole("listitem"),
    ).toHaveCount(2);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await page.setViewportSize(DESKTOP);
    await page.screenshot({ path: testInfo.outputPath("W29-detail.png"), fullPage: true });

    const firstObservation = await openDecision(page, language, "observe");
    await expectNoAxeViolations(page);
    await checkFocusTrap(page, firstObservation.dialog, language);
    await firstObservation.dialog.getByRole("textbox").fill(OBSERVATION_REASON);
    await page.screenshot({ path: testInfo.outputPath("W29-observe-dialog.png"), fullPage: true });
    await page.setViewportSize(COMPACT);
    await expectNoHorizontalScroll(page);
    await expectRegionFits(firstObservation.dialog);
    await page.keyboard.press("Escape");
    await expect(firstObservation.dialog).toHaveCount(0);
    await expect(firstObservation.trigger).toBeFocused();

    const approval = await openDecision(page, language, "approve");
    await approval.dialog.getByRole("textbox").fill(APPROVAL_REASON);
    await approval.submit.press("Enter");
    await expect(approval.dialog).toHaveCount(0);
    const history = page.getByRole("region", { name: copy["shift.page.history"] });
    await expect(history.getByText(APPROVAL_REASON, { exact: true })).toBeVisible();

    const observation = await openDecision(page, language, "observe");
    const reason = observation.dialog.getByRole("textbox");
    await expect(reason).toHaveValue(OBSERVATION_REASON);
    await observation.submit.press("Enter");
    await expect(
      observation.dialog.getByText(copy["shift.error.invalid"], { exact: true }),
    ).toBeVisible();
    await expect(reason).toHaveValue(OBSERVATION_REASON);
    await expectRegionFits(observation.dialog);
    await reason.fill(REVISED_REASON);
    await observation.submit.press("Enter");
    await expect(observation.dialog).toHaveCount(0);
    await expect(history.getByText(REVISED_REASON, { exact: true })).toBeVisible();
    await expect(history.getByText(APPROVAL_REASON, { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);

    const expanded = await openDecision(page, language, "observe");
    await expandText(page.getByRole("main", { includeHidden: true }));
    await expandText(expanded.dialog);
    await expectNoHorizontalScroll(page);
    await expectRegionFits(expanded.dialog);
  });
}
