import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
export const THEMES = ["light", "dark"] as const;
export const LANGUAGES = ["es-MX", "en"] as const;
const THEME_KEY = "wolbachia.theme";
const LANGUAGE_KEY = "wolbachia.language";

/** Sets the stored theme and language before the first load, like a returning user. */
export async function rememberPreferences(
  page: Page,
  theme: (typeof THEMES)[number],
  language: (typeof LANGUAGES)[number],
): Promise<void> {
  await page.addInitScript(
    ([themeKey, themeValue, languageKey, languageValue]) => {
      window.localStorage.setItem(themeKey as string, themeValue as string);
      window.localStorage.setItem(languageKey as string, languageValue as string);
    },
    [THEME_KEY, theme, LANGUAGE_KEY, language],
  );
}

/** axe against WCAG 2.0, 2.1 and 2.2 level A and AA. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  // Sample final rendered colors, not intermediate dialog/backdrop opacity.
  // Infinite skeleton/spinner motion must not prevent an accessibility audit.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
}
