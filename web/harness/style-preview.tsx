/** DEV ONLY. Separate Vite entry: never imported by index.html or production routes. */
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@wolbachia/tokens/tokens.css";
import "../src/styles/global.css";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { RouterProvider } from "@tanstack/react-router";
import { createWebApiClient } from "../src/api/create-web-api-client";
import { createAppQueryClient } from "../src/api/query-client";
import { ApiClientProvider } from "../src/api/ApiClientProvider";
import { createFakeApi, makeMe, noContent } from "../src/test/fake-api";
import { setupI18n } from "../src/i18n/setup-i18n";
import { ThemePreferenceContext } from "../src/theme/preference-context";
import { applyTheme } from "../src/theme/theme";
import { createPreviewRouter } from "./preview-router";
if (!import.meta.env.DEV) throw new Error("The style preview is development-only.");
const params = new URLSearchParams(window.location.search);
const previewTheme = params.get("theme") === "dark" ? "dark" : "light";
applyTheme(previewTheme);
const i18n = await setupI18n(params.get("lang") === "en" ? "en" : "es-MX");
const fake = createFakeApi({
  "GET /api/v1/me/": Response.json(
    makeMe({ permissions: ["catalog.read", "rule_parameter.read", "motorcycle.read"] }),
  ),
  "POST /api/v1/auth/logout/": noContent(),
});
const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: fake.fetch });
const queryClient = createAppQueryClient({ retry: false });
const router = createPreviewRouter({ client, queryClient });
await router.load();
const container = document.getElementById("root");
if (!container) throw new Error("Missing #root in style-preview.html");
createRoot(container).render(
  <ThemePreferenceContext value={previewTheme}>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider client={client}>
          <RouterProvider router={router} />
        </ApiClientProvider>
      </QueryClientProvider>
    </I18nextProvider>
  </ThemePreferenceContext>,
);
