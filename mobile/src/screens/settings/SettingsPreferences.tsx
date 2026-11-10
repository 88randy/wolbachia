import { usePreferences } from "../../app/PreferencesProvider.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { DarkModeRow } from "./DarkModeRow.tsx";
import { LanguageRow } from "./LanguageRow.tsx";
import { TextSizeRow } from "./TextSizeRow.tsx";

export function SettingsPreferences() {
  const { hasError } = usePreferences();
  const t = useT();
  return (
    <>
      {hasError ? <InfoNotice tone="warning" message={t("mobile.settings.saveFailed")} /> : null}
      <LanguageRow />
      <TextSizeRow />
      <DarkModeRow />
    </>
  );
}
