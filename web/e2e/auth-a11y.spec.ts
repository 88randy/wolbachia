import { expect, test } from "./fixtures/test";
import { expectNoAxeViolations, LANGUAGES, rememberPreferences, THEMES } from "./fixtures/a11y";
import { mockApi } from "./fixtures/mock-api";
import { scenarios } from "./fixtures/scenarios";

for (const theme of THEMES) {
  for (const language of LANGUAGES) {
    test.describe(`accessibility (axe, WCAG 2.2 AA): ${theme}, ${language}`, () => {
      for (const scenario of scenarios) {
        test(scenario.name, async ({ page }) => {
          const api = await mockApi(page, scenario.api);
          await rememberPreferences(page, theme, language);

          await scenario.reach(page, api);

          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await expect(page.locator("html")).toHaveAttribute("lang", language);
          await expectNoAxeViolations(page);
        });
      }
    });
  }
}
