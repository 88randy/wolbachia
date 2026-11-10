import type { Page } from "@playwright/test";
import type { MessageKey } from "@wolbachia/i18n";
import { messages } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
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

const BAG_ID = "30000000-0000-4000-8000-000000000001";
const READING_ID = "30000000-0000-4000-8000-000000000002";
const RECEIPT_ID = "30000000-0000-4000-8000-000000000003";
const AUTHOR_ID = "30000000-0000-4000-8000-000000000004";
const CAPTURED_AT = "2026-11-03T15:30:00Z";
const RECEIVED_AT = "2026-11-04T16:10:00Z";
const CODE = "B-0030";
const MOBILE_VIEWPORT = { width: 320, height: 800 };
const DESKTOP_VIEWPORT = { width: 1280, height: 1600 };
const SOURCE = {
  event_id: "30000000-0000-4000-8000-000000000005",
  device_time: CAPTURED_AT,
  server_received_at: CAPTURED_AT,
  rules_version: "w34-test-rules",
  catalog_version: "w34-test-catalog",
  evaluated_rules: {},
  rule_version_ids: {},
  manual_capture: false,
  gps: null,
  status: "active" as const,
  voided_at: null,
  void_reason: "",
  void_reason_code: "",
  created_by: AUTHOR_ID,
  created_at: CAPTURED_AT,
};
const BAG: Schemas["Bag"] = {
  ...SOURCE,
  id: BAG_ID,
  code: CODE,
  reading: READING_ID,
  collector: AUTHOR_ID,
  field_flags: {},
  lab: { status: "expected", revision: 0, receipt_id: null, count_id: null, rejection_id: null },
};
const RECEIPT: Schemas["LabReceipt"] = {
  id: RECEIPT_ID,
  reading_id: READING_ID,
  bag_id: BAG_ID,
  kind: "bag",
  created_at: RECEIVED_AT,
  created_by: AUTHOR_ID,
};
const READING: Schemas["Reading"] = {
  ...SOURCE,
  id: READING_ID,
  code: READING_ID,
  ovitrap: "30000000-0000-4000-8000-000000000006",
  point_version: "30000000-0000-4000-8000-000000000007",
  finding: "30000000-0000-4000-8000-000000000008",
  finding_code: "paddle_present",
  incident_link: null,
  finding_label: {},
  other_text: "",
  paddle_present: true,
  has_eggs: false,
  temperature_c: null,
  humidity_pct: null,
  paddle_type: null,
  is_lagged: false,
  is_index_excluded: false,
  index_exclusion_reason: "",
  is_countable: true,
  lab_receipt: RECEIPT,
  epi_week: "2026-W45",
  bag_id: BAG_ID,
  bag_code: CODE,
};

function pageOf(results: readonly unknown[], count = results.length) {
  return { count, next: null, previous: null, results };
}

/** The server exposes a receipt only after the explicit scanner command succeeds. */
async function mockReception(page: Page) {
  let isReceived = false;
  const commands: unknown[] = [];
  await mockApi(page, {
    me: makeMe({
      permissions: ["bag.receive", "reading.read", "egg_count.create"],
      scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
    }),
  });
  await page.route("**/api/v1/bags/**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      commands.push(request.postDataJSON() as unknown);
      isReceived = true;
      return route.fulfill({
        json: {
          bag: { id: BAG_ID, code: CODE },
          reading: { id: READING_ID, paddle_present: true },
          receipt: RECEIPT,
        } satisfies Schemas["LabReceptionOutcome"],
      });
    }
    const path = new URL(request.url()).pathname;
    if (path === `/api/v1/bags/${BAG_ID}/`) return route.fulfill({ json: BAG });
    return route.fulfill({ json: pageOf([], isReceived ? 0 : 1) });
  });
  await page.route("**/api/v1/lab-receptions/**", (route) =>
    route.fulfill({ json: pageOf(isReceived ? [RECEIPT] : []) }),
  );
  await page.route(`**/api/v1/readings/${READING_ID}/`, (route) =>
    route.fulfill({ json: READING }),
  );
  return commands;
}

for (const theme of THEMES) {
  for (const language of LANGUAGES) {
    test(`W34 scanner and accessible reflow: ${theme}, ${language}`, async ({ page }, testInfo) => {
      const text = (key: MessageKey) => messages[language][key];
      await rememberPreferences(page, theme, language);
      const commands = await mockReception(page);
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto("/lab");
      await page.getByRole("link", { name: text("labReception.page.title"), exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("heading", { level: 1, name: text("labReception.page.title") }),
      ).toBeVisible();
      const scan = page.getByRole("textbox", {
        name: text("labReception.scan.label"),
        exact: true,
      });
      await expect(scan).toBeFocused();
      await page.keyboard.type(` ${CODE} `);
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("status").filter({ hasText: text("labReception.scan.received") }),
      ).toContainText(CODE);
      await expect(scan).toBeFocused();
      await expect(scan).toHaveValue("");
      expect(commands).toEqual([
        { code: CODE, command_id: expect.stringMatching(/^[0-9a-f-]{36}$/) },
      ]);
      const table = page.getByRole("table", { name: text("labReception.table.received") });
      const received = table.getByRole("row", { name: new RegExp(CODE) });
      await expect(received).toContainText(text("labReception.status.received"));
      const expand = received.getByRole("button", { name: text("refresh.table.expand") });
      await expand.focus();
      await page.keyboard.press("Enter");
      const facts = page.locator("dl").filter({ hasText: text("labReception.table.hasEggs") });
      await expect(facts).toContainText(text("labReception.table.no"));
      await expect(
        page.getByRole("link", { name: text("labReception.action.countQueue") }),
      ).toHaveAttribute("href", "/lab/egg-counts");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      const noPaddle = page
        .locator("summary")
        .filter({ hasText: text("labReception.action.receiveNoPaddle") });
      await noPaddle.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("textbox", { name: text("labReception.scan.readingId") }),
      ).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      await page.getByRole("main").evaluate((main) => {
        main.scrollTop = 0;
      });
      await page.screenshot({ path: testInfo.outputPath("W34-320.png"), fullPage: true });
      await page.setViewportSize(DESKTOP_VIEWPORT);
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      await page.getByRole("main").evaluate((main) => {
        main.scrollTop = 0;
      });
      await page.screenshot({ path: testInfo.outputPath("W34-1280.png"), fullPage: true });
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.getByRole("main").evaluate((main) => {
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const current = node.textContent ?? "";
          if (current.trim())
            node.textContent = `${current}${current.slice(0, Math.ceil(current.length * 0.3))}`;
        }
      });
      await expectNoHorizontalScroll(page);
    });
  }
}
