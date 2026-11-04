import { StrictMode } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { readAppConfig } from "../config/app-config";
import { getInitialLocale } from "../i18n/locale";
import { setupI18n } from "../i18n/setup-i18n";
import { ConfigErrorScreen } from "../states/ConfigErrorScreen";
import { applyTheme, getInitialTheme } from "../theme/theme";
import { App } from "./App";

function chooseScreen(env: Record<string, unknown>): ReactElement {
  const result = readAppConfig(env);
  if (result.ok) return <App />;
  console.error(`Invalid app configuration: ${result.variable} is ${result.problem}.`);
  return <ConfigErrorScreen />;
}

/**
 * Boots the app: theme and language first (so even the configuration error is styled and
 * translated), then the configuration check, then the first render.
 */
export async function startApp(
  container: HTMLElement,
  env: Record<string, unknown>,
): Promise<void> {
  applyTheme(getInitialTheme());
  const i18n = await setupI18n(getInitialLocale());
  createRoot(container).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>{chooseScreen(env)}</I18nextProvider>
    </StrictMode>,
  );
}
