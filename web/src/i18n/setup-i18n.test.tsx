import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider, useTranslation } from "react-i18next";
import { beforeEach, describe, expect, test } from "vitest";
import { STORAGE_KEYS } from "../storage/safe-storage";
import { getInitialLocale } from "./locale";
import { setupI18n } from "./setup-i18n";
import { useLanguage } from "./use-language";

function Probe() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  return (
    <>
      <p>{t("shell.nav.home")}</p>
      <p data-testid="language">{language}</p>
      <button
        type="button"
        onClick={() => {
          setLanguage(language === "en" ? "es-MX" : "en");
        }}
      >
        switch
      </button>
    </>
  );
}

async function renderProbe(language: "es-MX" | "en") {
  const instance = await setupI18n(language);
  render(
    <I18nextProvider i18n={instance}>
      <Probe />
    </I18nextProvider>,
  );
  return instance;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("setupI18n", () => {
  test("renders Spanish from the shared catalog and sets <html lang>", async () => {
    await renderProbe("es-MX");

    expect(screen.getByText("Inicio")).toBeDefined();
    expect(document.documentElement.lang).toBe("es-MX");
  });

  test("switches language without reloading and updates <html lang>", async () => {
    await renderProbe("es-MX");

    await userEvent.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByText("Home")).toBeDefined();
    expect(screen.getByTestId("language").textContent).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  test("remembers the chosen language for the next visit", async () => {
    await renderProbe("es-MX");

    await userEvent.click(screen.getByRole("button", { name: "switch" }));

    expect(window.localStorage.getItem(STORAGE_KEYS.language)).toBe("en");
    expect(getInitialLocale()).toBe("en");
  });

  test("falls back to es-MX when the stored language is not supported", () => {
    window.localStorage.setItem(STORAGE_KEYS.language, "fr");

    expect(getInitialLocale()).toBe("es-MX");
  });

  test("rejects unknown keys at compile time", async () => {
    const instance = await setupI18n("es-MX");

    // @ts-expect-error "shell.nav.unknown" is not a key of the shared catalog.
    instance.t("shell.nav.unknown");

    expect(instance.t("shell.nav.home")).toBe("Inicio");
  });
});
