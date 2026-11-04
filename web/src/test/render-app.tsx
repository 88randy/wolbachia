import type { Locale } from "@wolbachia/i18n";
import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
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
import type { Me } from "../session/me";
import { apiError, createFakeApi, makeMe } from "./fake-api";

interface RenderAppOptions {
  /** Address to open, e.g. `/incidents`. */
  path?: string;
  language?: Locale;
  /**
   * Who is signed in: a user (default: `makeMe()`), or `null` for nobody (`/me/` answers 401).
   * Ignored when `fetch` is given.
   */
  me?: Me | null;
  /** Replaces the whole fake network (the test then answers `/me/` itself). */
  fetch?: (request: Request) => Promise<Response>;
}

interface RenderedApp extends RenderResult {
  router: ReturnType<typeof createAppRouter>;
  queryClient: QueryClient;
}

function defaultFetch(me: Me | null): (request: Request) => Promise<Response> {
  return createFakeApi({
    "GET /api/v1/me/": me === null ? apiError(401, "not_authenticated") : Response.json(me),
  }).fetch;
}

/** Renders the whole app (shell + routes) at an address, with the real catalogs. */
export async function renderApp(options: RenderAppOptions = {}): Promise<RenderedApp> {
  const { path = "/", language = "es-MX", me = makeMe() } = options;
  const fetch = options.fetch ?? defaultFetch(me);
  const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch });
  const queryClient = createAppQueryClient({ retry: false });
  const router = createAppRouter({
    client,
    queryClient,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const instance = await setupI18n(language);
  await router.load();
  const result = render(
    <I18nextProvider i18n={instance}>
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider client={client}>
          <App router={router} />
        </ApiClientProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return Object.assign(result, { router, queryClient });
}
