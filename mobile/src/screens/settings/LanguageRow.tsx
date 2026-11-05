import { usePreferences } from "../../app/PreferencesProvider.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { SettingRow } from "../../ui/SettingRow.tsx";

/** One button that switches to the other language; its label names the language you will get. */
export function LanguageRow() {
  const t = useT();
  const { locale, setLocale } = usePreferences();
  const isSpanish = locale === "es-MX";
  return (
    <SettingRow
      title={t("mobile.settings.language")}
      hint={isSpanish ? t("mobile.settings.languageEs") : t("mobile.settings.languageEn")}
      control={
        <Button
          variant="outline"
          label={isSpanish ? t("mobile.settings.languageEn") : t("mobile.settings.languageEs")}
          onPress={() => {
            setLocale(isSpanish ? "en" : "es-MX");
          }}
        />
      }
    />
  );
}
