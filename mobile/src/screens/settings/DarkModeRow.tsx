import { usePreferences } from "../../app/PreferencesProvider.tsx";
import type { ThemePreference } from "../../app/preferences.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { PreferenceChoices } from "./PreferenceChoices.tsx";

const PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

export function DarkModeRow() {
  const t = useT();
  const { scheme, setScheme } = usePreferences();
  return (
    <PreferenceChoices
      title={t("mobile.settings.darkMode")}
      options={PREFERENCES.map((choice) => ({ id: choice, label: t(`mobile.preview.${choice}`) }))}
      selectedId={scheme}
      onSelect={(id) => {
        const choice = PREFERENCES.find((option) => option === id);
        if (choice) setScheme(choice);
      }}
    />
  );
}
