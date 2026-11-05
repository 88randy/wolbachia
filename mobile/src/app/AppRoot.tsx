// One import per weight: the package's main entry would bundle all 18 font files (6 MB).
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Inter_800ExtraBold } from "@expo-google-fonts/inter/800ExtraBold";
import { useFonts } from "expo-font";

import { AppShell } from "./AppShell.tsx";
import { BootScreen } from "./BootScreen.tsx";
import { PreferencesProvider } from "./PreferencesProvider.tsx";
import { ServicesContext } from "./services-context.ts";
import { useAppBoot } from "./use-app-boot.ts";

const FONTS = { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold };

/**
 * Loads Inter and opens the phone's database, then shows the app. Nothing here waits for the
 * network: the first screen appears as soon as local storage is ready.
 */
export function AppRoot() {
  const [areFontsLoaded, fontError] = useFonts(FONTS);
  const boot = useAppBoot();
  // A missing font only falls back to the system font; it never blocks the app.
  const isFontReady = areFontsLoaded || fontError !== null;
  if (boot.status === "failed") return <BootScreen hasFailed />;
  if (boot.status === "loading" || !isFontReady) return <BootScreen hasFailed={false} />;
  return (
    <ServicesContext.Provider value={boot.services}>
      <PreferencesProvider initial={boot.preferences}>
        <AppShell />
      </PreferencesProvider>
    </ServicesContext.Provider>
  );
}
