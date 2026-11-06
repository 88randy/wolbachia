import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { setupI18n } from "../i18n/setup-i18n";
import { stubColorScheme } from "../test/color-scheme";
import { ThemeSwitch } from "./ThemeSwitch";
import { STORAGE_KEYS } from "../storage/safe-storage";
import { renderApp } from "../test/render-app";
import { applyTheme, getInitialTheme } from "../theme/theme";

beforeEach(() => {
  window.localStorage.clear();
  applyTheme("light");
});
afterEach(() => {
  act(() => {
    applyTheme("light");
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("the sole top-bar switch follows System until a keyboard toggle stores an explicit choice", async () => {
  const scheme = stubColorScheme(false);
  applyTheme(getInitialTheme());
  await renderApp();
  const control = within(screen.getByRole("banner")).getByRole("switch", { name: "Tema oscuro" });
  expect(screen.getAllByRole("switch")).toHaveLength(1);
  expect(control.getAttribute("aria-checked")).toBe("false");
  act(() => {
    scheme.setDark(true);
  });
  expect(control.getAttribute("aria-checked")).toBe("true");
  expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBeNull();
  control.focus();
  await userEvent.keyboard(" ");
  expect(control.getAttribute("aria-checked")).toBe("false");
  expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe("light");
  act(() => {
    scheme.setDark(false);
    scheme.setDark(true);
  });
  expect(document.documentElement.dataset["theme"]).toBe("light");
  await userEvent.keyboard("{Enter}");
  expect(control.getAttribute("aria-checked")).toBe("true");
  expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe("dark");
});

async function renderSwitch(language: "es-MX" | "en" = "es-MX") {
  const i18n = await setupI18n(language);
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeSwitch />
    </I18nextProvider>,
  );
}

test("a storage write failure still changes the current page and announced switch state", async () => {
  await renderSwitch();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage is full", "QuotaExceededError");
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  await userEvent.click(screen.getByRole("switch"));
  expect(document.documentElement.dataset["theme"]).toBe("dark");
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
});

test.each([
  { language: "es-MX", label: "Tema oscuro" },
  { language: "en", label: "Dark theme" },
] as const)("the switch has a translated $language name", async ({ language, label }) => {
  await renderSwitch(language);
  expect(screen.getByRole("switch", { name: label })).toBeDefined();
});

test("the theme switch has no axe violations", async () => {
  const { container } = await renderSwitch();
  expect(await axe(container)).toHaveNoViolations();
});
