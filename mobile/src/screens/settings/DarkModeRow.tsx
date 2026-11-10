import { spacing } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { usePreferences } from "../../app/PreferencesProvider.tsx";
import type { ThemePreference } from "../../app/preferences.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { SettingRow } from "../../ui/SettingRow.tsx";
import { ThemeChoice } from "../../ui/ThemeChoice.tsx";

const PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];
const styles = StyleSheet.create({ choices: { gap: spacing[1] } });

export function DarkModeRow() {
  const t = useT();
  const { scheme, setScheme } = usePreferences();
  return (
    <SettingRow
      title={t("mobile.settings.darkMode")}
      hint={t("mobile.preview.themeHint")}
      control={
        <View style={styles.choices}>
          {PREFERENCES.map((choice) => (
            <ThemeChoice
              key={choice}
              choice={choice}
              isSelected={scheme === choice}
              onPress={() => {
                setScheme(choice);
              }}
            />
          ))}
        </View>
      }
    />
  );
}
