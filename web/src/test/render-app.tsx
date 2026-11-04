import type { Locale } from "@wolbachia/i18n";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { ApiClientProvider } from "../api/ApiClientProvider";
import { createWebApiClient } from "../api/create-web-api-client";
import { createAppQueryClient } from "../api/query-client";
import { App } from "../app/App";
import { setupI18n } from "../i18n/setup-i18n";
import { createAppRouter } from "../router/router";

interface RenderAppOptions {
  /** Address to open, e.g. `/incidents`. */
  path?: string;
  language?: Locale;
  /** Replaces the network. By default any API request fails the test. */
  fetch?: (request: Request) => Promise<Response>;
}

function failOnRequest(request: Request): Promise<Response> {
  return Promise.reject(new Error(`Unexpected API request: ${request.method} ${request.url}`));
}

/** Renders the whole app (shell + routes) at an address, with the real catalogs. */
export async function renderApp(options: RenderAppOptions = {}): Promise<RenderResult> {
  const { path = "/", language = "es-MX", fetch = failOnRequest } = options;
  const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch });
  const queryClient = createAppQueryClient({ retry: false });
  const router = createAppRouter({
    client,
    queryClient,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const instance = await setupI18n(language);
  await router.load();
  return render(
    <I18nextProvider i18n={instance}>
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider client={client}>
          <App router={router} />
        </ApiClientProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}
