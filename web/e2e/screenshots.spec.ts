import { test } from "./fixtures/test";
import { LANGUAGES, rememberPreferences, THEMES } from "./fixtures/a11y";
import { mockApi } from "./fixtures/mock-api";
import { scenarios } from "./fixtures/scenarios";

/**
 * Regenerates the PNGs of web/docs/screenshots/ for the screens of #28, the phones list of #29 and W62 of #36. It is not a test: it only
 * runs on request (`E2E_SCREENSHOTS=1 npm run e2e -w @wolbachia/web -- screenshots`), so the
 * normal e2e run never rewrites files.
 */
const SHOTS: readonly { scenario: string; file: string; isTall?: boolean }[] = [
  { scenario: "sign-in", file: "sign-in" },
  { scenario: "sign-in with an error", file: "sign-in-error" },
  { scenario: "sign-in with a lockout", file: "sign-in-lockout" },
  { scenario: "forgot password", file: "forgot-password" },
  { scenario: "forgot password, sent", file: "forgot-password-sent" },
  { scenario: "reset password", file: "reset-password" },
  { scenario: "reset password with a weak password", file: "reset-password-weak" },
  { scenario: "reset password with an invalid link", file: "reset-password-invalid-link" },
  { scenario: "organization selection", file: "select-organization" },
  { scenario: "no permission", file: "no-permission" },
  { scenario: "user menu open", file: "user-menu" },
  { scenario: "re-authentication dialog", file: "session-expired-dialog" },
  { scenario: "phones list", file: "phones-list" },
  { scenario: "phones list with a filter and an ignored parameter", file: "phones-list-filtered" },
  { scenario: "phones list that failed", file: "phones-list-error" },
  { scenario: "rule parameters list", file: "rule-parameters-list" },
  {
    scenario: "rule parameter with history and voided versions",
    file: "rule-parameter-history",
    isTall: true,
  },
  {
    scenario: "rule parameter form with the comparison and a missing reason",
    file: "rule-parameter-form",
    isTall: true,
  },
];

const TALL_HEIGHT = 1500;

test.skip(process.env["E2E_SCREENSHOTS"] !== "1", "only on request");

// W1 in every theme and language; the other screens in two representative combinations.
const REPRESENTATIVE = [
  { theme: "light", language: "es-MX" },
  { theme: "dark", language: "en" },
] as const;

const cases = SHOTS.flatMap((shot) =>
  shot.file === "sign-in"
    ? THEMES.flatMap((theme) => LANGUAGES.map((language) => ({ ...shot, theme, language })))
    : REPRESENTATIVE.map((variant) => ({ ...shot, ...variant })),
);

for (const { scenario: scenarioName, file, theme, language, isTall } of cases) {
  test(`${file}-${theme}-${language}`, async ({ page }) => {
    const scenario = scenarios.find((candidate) => candidate.name === scenarioName);
    if (scenario === undefined) throw new Error(`No scenario "${scenarioName}"`);
    const api = await mockApi(page, scenario.api);
    // The shell scrolls inside its own frame, so a long page is shot with a taller window.
    if (isTall === true) await page.setViewportSize({ width: 1280, height: TALL_HEIGHT });
    await rememberPreferences(page, theme, language);
    await scenario.reach(page, api);
    await page.screenshot({ path: `docs/screenshots/${file}-${theme}-${language}.png` });
  });
}
