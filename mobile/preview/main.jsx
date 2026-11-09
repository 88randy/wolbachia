import { createRoot } from "react-dom/client";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { ThemeProvider } from "../src/theme/ThemeProvider.tsx";
import { StylePreview } from "../src/ui/preview/StylePreview.tsx";
import "./preview.css";

const parameters = new URLSearchParams(window.location.search);
const scheme = parameters.get("theme") === "dark" ? "dark" : "light";
const locale = parameters.get("lang") === "en" ? "en" : "es-MX";
const scale = parameters.get("scale") === "130" ? "130% (browser approximation)" : "100%";

function BrowserPreview() {
  return (
    <>
      <p className="renderer-label">
        React Native Web 0.21.4 · browser renderer · {locale} · text {scale}
        <br />
        Actual shared mobile components. Synthetic examples. Android rendering and TalkBack remain
        unverified.
      </p>
      <div className="device-frame">
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 360, height: 800 },
            insets: { top: 0, right: 0, bottom: 0, left: 0 },
          }}
        >
          <I18nProvider locale={locale}>
            <ThemeProvider scheme={scheme}>
              <StylePreview
                onBack={() => {
                  window.location.reload();
                }}
              />
            </ThemeProvider>
          </I18nProvider>
        </SafeAreaProvider>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<BrowserPreview />);
