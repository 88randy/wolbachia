/**
 * DEV ONLY: entry of `web/harness/void.html` (with `VoidHarness.tsx`), served by `npm run dev -w @wolbachia/web` at
 * `/harness/void.html`. It is not part of the production build (Vite builds `index.html` only) and
 * not a route of the app. `?answer=` picks what the pretend server says: `ok` (default),
 * `tooShort`, `alreadyVoided`, `blocked`, `network`, `slow`. `?lang=en` and `?theme=dark` switch.
 */
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-700.css";
import "@wolbachia/tokens/tokens.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiClientProvider } from "../src/api/ApiClientProvider";
import { createAppQueryClient } from "../src/api/query-client";
import { createWebApiClient } from "../src/api/create-web-api-client";
import { createFakeApi, makeVoidReasonItems } from "../src/test/fake-api";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import "../src/styles/global.css";
import { setupI18n } from "../src/i18n/setup-i18n";
import { applyTheme } from "../src/theme/theme";
import type { VoidResult } from "../src/void/submit-void";
import { VoidHarness } from "./VoidHarness";

const params = new URLSearchParams(window.location.search);
const FAILURES: Record<string, VoidResult> = {
  tooShort: { ok: false, failure: { kind: "reasonTooShort", minLength: 15 } },
  alreadyVoided: { ok: false, failure: { kind: "alreadyVoided" } },
  blocked: { ok: false, failure: { kind: "blocked" } },
  network: { ok: false, failure: { kind: "service", failure: "network" } },
};

function submit(): Promise<VoidResult> {
  const answer = params.get("answer") ?? "ok";
  const delay = answer === "slow" ? 3000 : 300;
  const result: VoidResult = FAILURES[answer] ?? { ok: true };
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve(result);
    }, delay),
  );
}

applyTheme(params.get("theme") === "dark" ? "dark" : "light");
const i18n = await setupI18n(params.get("lang") === "en" ? "en" : "es-MX");
const container = document.getElementById("root");
if (container === null) throw new Error("Missing #root in void.html");
const fake = createFakeApi({
  "GET /api/v1/catalogs/void-reason/items/": Response.json({
    count: 3,
    next: null,
    previous: null,
    results: makeVoidReasonItems(),
  }),
});
const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: fake.fetch });
createRoot(container).render(
  <I18nextProvider i18n={i18n}>
    <QueryClientProvider client={createAppQueryClient({ retry: false })}>
      <ApiClientProvider client={client}>
        <VoidHarness submit={submit} />
      </ApiClientProvider>
    </QueryClientProvider>
  </I18nextProvider>,
);
