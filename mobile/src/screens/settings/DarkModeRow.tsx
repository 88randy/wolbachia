import { Switch } from "react-native";

import { usePreferences } from "../../app/PreferencesProvider.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { SettingRow } from "../../ui/SettingRow.tsx";

export function DarkModeRow() {
  const t = useT();
  const { theme } = useTheme();
  const { scheme, setScheme } = usePreferences();
  return (
    <SettingRow
      title={t("mobile.settings.darkMode")}
      hint={t("mobile.settings.darkModeHint")}
      control={
        <Switch
          accessibilityLabel={t("mobile.settings.darkMode")}
          value={scheme === "dark"}
          onValueChange={(isDark) => {
            setScheme(isDark ? "dark" : "light");
          }}
          trackColor={{ false: theme.color.border.strong, true: theme.color.action }}
          thumbColor={theme.color.surface}
        />
      }
    />
  );
}
