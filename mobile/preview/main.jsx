import { createRoot } from "react-dom/client";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { ThemeProvider } from "../src/theme/ThemeProvider.tsx";
import { StylePreview } from "../src/ui/preview/StylePreview.tsx";
import { FuelPreview } from "./FuelPreview.jsx";
import { ReleasePreview } from "./ReleasePreview.jsx";
import "./preview.css";

const parameters = new URLSearchParams(window.location.search);
const scheme = parameters.get("theme") === "dark" ? "dark" : "light";
const locale = parameters.get("lang") === "en" ? "en" : "es-MX";
const scale = parameters.get("scale") === "130" ? "130% (browser approximation)" : "100%";
const isFuel = parameters.get("screen") === "fuel";
const isRelease = parameters.get("screen") === "release";
const isReleaseBlocked = parameters.get("blocked") === "1";
const description = isRelease
  ? "Actual P18/P19 view. Synthetic prerequisites and one synthetic evidence reference; no photo bytes, storage, server or native activity. "
  : isFuel
    ? "Actual P22 components. In-memory synthetic draft; Save validates only and the camera cancels without capturing evidence. "
    : "Actual shared mobile components. Synthetic examples. ";

function BrowserPreview() {
  return (
    <>
      <p className="renderer-label">
        React Native Web 0.21.4 · browser renderer · {locale} · text {scale}
        <br />
        {description}
        Android rendering and TalkBack remain unverified.
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
              {isRelease ? (
                <ReleasePreview isBlocked={isReleaseBlocked} />
              ) : isFuel ? (
                <FuelPreview />
              ) : (
                <StylePreview
                  onBack={() => {
                    window.location.reload();
                  }}
                />
              )}
            </ThemeProvider>
          </I18nProvider>
        </SafeAreaProvider>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<BrowserPreview />);
