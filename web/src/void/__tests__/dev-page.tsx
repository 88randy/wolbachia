/**
 * DEV ONLY: entry of `web/harness/void.html`, served by `npm run dev -w @wolbachia/web` at
 * `/harness/void.html`. It is not part of the production build (Vite builds `index.html` only) and
 * not a route of the app. `?answer=` picks what the pretend server says: `ok` (default),
 * `tooShort`, `alreadyVoided`, `blocked`, `network`, `slow`. `?lang=en` and `?theme=dark` switch.
 */
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-700.css";
import "@wolbachia/tokens/tokens.css";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import "../../styles/global.css";
import { setupI18n } from "../../i18n/setup-i18n";
import { applyTheme } from "../../theme/theme";
import type { VoidResult } from "../submit-void";
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
createRoot(container).render(
  <I18nextProvider i18n={i18n}>
    <VoidHarness submit={submit} />
  </I18nextProvider>,
);
