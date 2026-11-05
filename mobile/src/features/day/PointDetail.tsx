import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import type { M06Model } from "./use-m-06.ts";
import { TaskSummary } from "./TaskSummary.tsx";
import { PointHistory } from "./PointHistory.tsx";
import { PointDirections } from "./PointDirections.tsx";
export function PointDetail({ model }: { readonly model: M06Model }) {
  const t = useT();
  const row = model.selected;
  if (row === null) return null;
  return (
    <Card>
      <TaskSummary row={row} />
      <PointDirections model={model} />
      <PointHistory task={row.task} />
      <AppText>{t("mobile.day.scanHint")}</AppText>
      <Button
        label={t("mobile.day.closeDetail")}
        variant="text"
        onPress={() => {
          void model.clearSelection();
        }}
      />
    </Card>
  );
}
