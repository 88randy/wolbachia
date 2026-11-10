import { usePreferences } from "../../app/PreferencesProvider.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { PreferenceChoices } from "./PreferenceChoices.tsx";

/** Native scaling remains enabled; the local choice can add larger text to both labels and inputs. */
export function TextSizeRow() {
  const t = useT();
  const { textSize, setTextSize } = usePreferences();
  return (
    <PreferenceChoices
      title={t("mobile.settings.textSize")}
      options={[
        { id: "system", label: t("mobile.settings.textSystem") },
        { id: "large", label: t("mobile.settings.textLarge") },
      ]}
      selectedId={textSize}
      onSelect={(id) => {
        setTextSize(id === "large" ? "large" : "system");
      }}
    />
  );
}
