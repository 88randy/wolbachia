import { expect, test } from "./fixtures/test";
import { THEMES, LANGUAGES, rememberPreferences, expectNoAxeViolations, expectNoHorizontalScroll } from "./fixtures/a11y";
import { mockApi } from "./fixtures/mock-api";
import { makeMe } from "../src/test/fake-api";
import { ID, incident } from "../src/test/incident-fixtures";
const MOBILE_WIDTH = 320;
const MOBILE_HEIGHT = 800;
for (const theme of THEMES) {
 for (const language of LANGUAGES) {
 test(`W6/W7 accessible read journey: ${theme}, ${language}`, async ({ page }) => {
 const record = incident({ action_permissions: { comment: false, reassign: false, change_severity: false, close: false, void: false } });
 await rememberPreferences(page, theme, language);
 await mockApi(page, { me: makeMe({ permissions: ["incident.read"], scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } } }) });
 await page.route("**/api/v1/incident-types/**", route => route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } }));
 await page.route("**/api/v1/incidents/**", route => {
 const path = new URL(route.request().url()).pathname;
 if (path === `/api/v1/incidents/${ID}/`) return route.fulfill({ json: record });
 const results = path.endsWith("/context-options/") ? [] : [record];
 return route.fulfill({ json: { count: results.length, next: null, previous: null, results } });
 });
 await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
 await page.goto("/incidents");
 await expect(page.getByRole("link", { name: "I-0033", exact: true })).toBeVisible();
 await expectNoHorizontalScroll(page);
 await expectNoAxeViolations(page);
 await page.getByRole("link", { name: "I-0033", exact: true }).focus();
 await page.keyboard.press("Enter");
 await expect(page.getByRole("heading", { level: 1, name: /I-0033/ })).toBeVisible();
 await expect(page.getByText("Original report", { exact: true })).toBeVisible();
 await expect(page.getByText("Escalation audit", { exact: true })).toBeVisible();
 await expectNoHorizontalScroll(page);
 await expectNoAxeViolations(page);
 });
 }
}
