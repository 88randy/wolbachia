/** DEV ONLY. Real app routes with synthetic local fixtures, excluded from the production entry. */
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@wolbachia/tokens/tokens.css";
import "../src/styles/global.css";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { I18nextProvider } from "react-i18next";
import { App } from "../src/app/App";
import { createAppRouter } from "../src/router/router";
import { createAppQueryClient } from "../src/api/query-client";
import { createWebApiClient } from "../src/api/create-web-api-client";
import { ApiClientProvider } from "../src/api/ApiClientProvider";
import { setupI18n } from "../src/i18n/setup-i18n";
import { applyTheme } from "../src/theme/theme";
import { createUxPreviewApi } from "./ux-preview-api";
if (!import.meta.env.DEV) throw new Error("UX preview is development-only.");
const params = new URLSearchParams(window.location.search);
applyTheme(params.get("theme") === "dark" ? "dark" : "light");
const i18n = await setupI18n(params.get("lang") === "en" ? "en" : "es-MX");
const fake = createUxPreviewApi();
const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: fake.fetch });
const queryClient = createAppQueryClient({ retry: false });
const path = params.get("path") ?? "/settings";
const router = createAppRouter({
  client,
  queryClient,
  history: createMemoryHistory({ initialEntries: [path] }),
});
await router.load();
const container = document.getElementById("root");
if (!container) throw new Error("Missing preview root.");
createRoot(container).render(
  <I18nextProvider i18n={i18n}>
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={client}>
        <App router={router} />
      </ApiClientProvider>
    </QueryClientProvider>
  </I18nextProvider>,
);
