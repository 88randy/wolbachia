import { expect, test } from "./fixtures/test";
import { makeMe } from "../src/test/fake-api";
import { mockApi } from "./fixtures/mock-api";
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  rememberPreferences,
  LANGUAGES,
  THEMES,
} from "./fixtures/a11y";

for (const language of LANGUAGES) {
  for (const theme of THEMES) {
    test(`W35 ${language} ${theme}: expanded labels, narrow layout and keyboard capture`, async ({
      page,
    }) => {
      await rememberPreferences(page, theme, language);
      await mockApi(page, {
        me: makeMe({
          permissions: ["egg_count.create"],
          scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
        }),
      });
      const bag = {
        id: "00000000-0000-4000-8000-000000000031",
        code: "B-031",
        reading_id: "reading-31",
        expected_revision: 0,
        has_eggs: true,
        is_lagged: false,
        is_index_excluded: false,
      };
      await page.route("**/api/v1/egg-counts/queue/**", (route) =>
        route.fulfill({ json: { count: 1, next: null, previous: null, results: [bag] } }),
      );
      await page.route("**/api/v1/bags/*/counts/", (route) =>
        route.fulfill({
          status: 201,
          json: {
            count: {
              id: "count-31",
              bag_id: bag.id,
              value: 12,
              created_by: "counter-31",
              created_at: "2026-11-03T15:00:00Z",
            },
            next_bag: null,
            queue_snapshot: { as_of: "2026-11-03T15:00:00Z", context: {} },
          },
        }),
      );
      await page.goto("/lab/egg-counts");
      const field = page.getByRole("textbox", {
        name: language === "en" ? "Laboratory eggs" : "Huevos de laboratorio",
      });
      await expect(field).toBeFocused();
      await page.evaluate(() => {
        document
          .querySelectorAll("main h1, main h2, main label, main button, main aside p")
          .forEach((element) => {
            element.append(
              document.createTextNode(
                " · " + "Additional".repeat(Math.ceil((element.textContent.length * 0.3) / 10)),
              ),
            );
          });
      });
      for (const width of [1280, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expectNoHorizontalScroll(page);
        await expectNoAxeViolations(page);
      }
      await page.keyboard.type("12");
      await page.keyboard.press("Enter");
      await expect(
        page.getByText(language === "en" ? "Count saved." : "Conteo guardado."),
      ).toBeVisible();
    });
  }
}
