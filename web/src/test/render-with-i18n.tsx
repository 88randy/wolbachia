import type { Locale } from "@wolbachia/i18n";
import { render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nextProvider } from "react-i18next";
import { setupI18n } from "../i18n/setup-i18n";

/** Renders a component with the real catalogs, in the given language (default es-MX). */
export async function renderWithI18n(
  ui: ReactElement,
  language: Locale = "es-MX",
): Promise<RenderResult> {
  const instance = await setupI18n(language);
  return render(<I18nextProvider i18n={instance}>{ui}</I18nextProvider>);
}
