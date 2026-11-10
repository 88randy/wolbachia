import { usePreferences } from "../../app/PreferencesProvider.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { SettingRow } from "../../ui/SettingRow.tsx";

/** Native scaling remains enabled; the local choice can add larger text to both labels and inputs. */
export function TextSizeRow() {
  const t = useT();
  const { textSize, setTextSize } = usePreferences();
  return (
    <SettingRow
      title={t("mobile.settings.textSize")}
      hint={t(textSize === "large" ? "mobile.settings.textLarge" : "mobile.settings.textSystem")}
      control={
        <Button
          variant="outline"
          label={t(
            textSize === "large" ? "mobile.settings.textSystem" : "mobile.settings.textLarge",
          )}
          onPress={() => {
            setTextSize(textSize === "large" ? "system" : "large");
          }}
        />
      }
    />
  );
}
