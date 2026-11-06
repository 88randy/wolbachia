import { hasCoordinates } from "./assignment-parser.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { NavigationFeedback } from "./NavigationFeedback.tsx";
import type { M06Model } from "./use-m-06.ts";
interface Props {
  readonly model: M06Model;
  readonly compact?: boolean;
}
export function PointDirections({ model, compact = false }: Props) {
  const t = useT();
  const row = model.selected;
  if (row === null) return null;
  if (!hasCoordinates(row.task)) return <AppText>{t("mobile.day.noLocation")}</AppText>;
  const navigate = () => {
    void model.navigate(row.task);
  };
  const coordinates = `${row.task.lat.toFixed(6)}, ${row.task.lng.toFixed(6)}`;
  return (
    <>
      <Button
        label={t(compact ? "mobile.day.go" : "mobile.day.navigate")}
        icon="navigation"
        variant="outline"
        onPress={navigate}
        disabled={model.isActing}
      />
      <NavigationFeedback outcome={model.state?.navigation?.outcome ?? null} />
      <AppText selectable>{t("mobile.day.coordinates", { coordinates })}</AppText>
      <AppText>
        {row.task.reference
          ? t("mobile.day.reference", { reference: row.task.reference })
          : t("mobile.day.noReference")}
      </AppText>
    </>
  );
}
