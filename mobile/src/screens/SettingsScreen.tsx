import { useT } from "../i18n/I18nProvider.tsx";
import { DEV_TOOLS_ENABLED } from "../config/build-config.ts";
import { AppHeader } from "../ui/AppHeader.tsx";
import { ScreenScaffold } from "../ui/ScreenScaffold.tsx";
import { DevToolsSection } from "./settings/DevToolsSection.tsx";
import { PersonalScreensRow } from "./settings/PersonalScreensRow.tsx";
import { SafetySection } from "./settings/SafetySection.tsx";
import { SettingsPreferences } from "./settings/SettingsPreferences.tsx";

/** P31: my screens, how the app looks and the state of what is still on the phone. */
export function SettingsScreen() {
  const t = useT();
  return (
    <ScreenScaffold header={<AppHeader title={t("mobile.settings.title")} />}>
      <PersonalScreensRow />
      <SettingsPreferences />
      <SafetySection />
      {DEV_TOOLS_ENABLED ? <DevToolsSection /> : null}
    </ScreenScaffold>
  );
}
