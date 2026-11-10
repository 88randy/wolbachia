import { View } from "react-native";
import { usePreferences } from "../../app/PreferencesProvider.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { LanguageRow } from "./LanguageRow.tsx";
import { DarkModeRow } from "./DarkModeRow.tsx";
import { TextSizeRow } from "./TextSizeRow.tsx";
import { settingsStyles } from "./styles.ts";

export function SettingsPreferences() {
  const { hasError } = usePreferences();
  const t = useT();
  return (
    <View style={settingsStyles.section}>
      {hasError ? (
        <Notice tone="warning" icon="alert" message={t("mobile.settings.saveFailed")} />
      ) : null}
      <LanguageRow />
      <TextSizeRow />
      <DarkModeRow />
    </View>
  );
}
