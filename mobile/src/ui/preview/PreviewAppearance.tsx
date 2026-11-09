import { useT } from "../../i18n/I18nProvider.tsx";
import type { ColorScheme } from "../../theme/ThemeProvider.tsx";
import { Button } from "../Button.tsx";
import { SettingRow } from "../SettingRow.tsx";

export function PreviewAppearance({
  scheme,
  onToggleScheme,
}: {
  readonly scheme: ColorScheme;
  readonly onToggleScheme: () => void;
}) {
  const t = useT();
  return (
    <SettingRow
      title={t(`mobile.preview.${scheme}`)}
      hint={t("mobile.preview.textScaleHint")}
      control={
        <Button
          variant="outline"
          label={t("mobile.preview.toggleTheme")}
          onPress={onToggleScheme}
        />
      }
    />
  );
}
