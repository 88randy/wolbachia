import { usePreferences } from "../../app/PreferencesProvider.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { PreferenceChoices } from "./PreferenceChoices.tsx";

/** Both languages are always visible; the current one is filled. */
export function LanguageRow() {
  const t = useT();
  const { locale, setLocale } = usePreferences();
  return (
    <PreferenceChoices
      title={t("mobile.settings.language")}
      options={[
        { id: "es-MX", label: t("mobile.settings.languageEs") },
        { id: "en", label: t("mobile.settings.languageEn") },
      ]}
      selectedId={locale}
      onSelect={(id) => {
        setLocale(id === "en" ? "en" : "es-MX");
      }}
    />
  );
}
