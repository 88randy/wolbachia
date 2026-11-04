import type { Locale } from "@wolbachia/i18n";
import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { App } from "../app/App";
import { setupI18n } from "../i18n/setup-i18n";
import { createAppRouter } from "../router/router";

interface RenderAppOptions {
  /** Address to open, e.g. `/incidents`. */
  path?: string;
  language?: Locale;
}

/** Renders the whole app (shell + routes) at an address, with the real catalogs. */
export async function renderApp(options: RenderAppOptions = {}): Promise<RenderResult> {
  const { path = "/", language = "es-MX" } = options;
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  const instance = await setupI18n(language);
  await router.load();
  return render(
    <I18nextProvider i18n={instance}>
      <App router={router} />
    </I18nextProvider>,
  );
}
