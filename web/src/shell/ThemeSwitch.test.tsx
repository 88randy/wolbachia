import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { setupI18n } from "../i18n/setup-i18n";
import { stubColorScheme } from "../test/color-scheme";
import { ThemeSwitch } from "./ThemeSwitch";
import { STORAGE_KEYS } from "../storage/safe-storage";
import { renderApp } from "../test/render-app";
import { applyTheme } from "../theme/theme";

beforeEach(() => {
  window.localStorage.clear();
  applyTheme("light");
});

afterEach(() => {
  applyTheme("light");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("the top bar theme selector applies and remembers the user's choice", async () => {
  stubColorScheme(true);
  window.localStorage.setItem(STORAGE_KEYS.theme, "light");
  await renderApp();
  const banner = within(screen.getByRole("banner"));
  const selector = banner.getByRole("combobox", { name: "Tema" });

  await userEvent.selectOptions(selector, "system");

  expect(document.documentElement.dataset["theme"]).toBe("dark");
  expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe("system");
});

async function renderSwitch(language: "es-MX" | "en" = "es-MX") {
  const i18n = await setupI18n(language);
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeSwitch />
    </I18nextProvider>,
  );
}

test("a storage write failure still changes the active preference", async () => {
  await renderSwitch();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage is full", "QuotaExceededError");
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  await userEvent.selectOptions(screen.getByRole("combobox"), "dark");

  expect(document.documentElement.dataset["theme"]).toBe("dark");
  expect(screen.getByRole<HTMLSelectElement>("combobox").value).toBe("dark");
});

test.each([
  { language: "es-MX", label: "Tema", options: ["Claro", "Oscuro", "Sistema"] },
  { language: "en", label: "Theme", options: ["Light", "Dark", "System"] },
] as const)("theme choices use the $language catalog", async ({ language, label, options }) => {
  await renderSwitch(language);

  const selector = screen.getByRole("combobox", { name: label });
  expect(
    within(selector)
      .getAllByRole("option")
      .map((option) => option.textContent),
  ).toEqual(options);
});

test("the theme selector has no axe violations", async () => {
  const { container } = await renderSwitch();

  expect(await axe(container)).toHaveNoViolations();
});
