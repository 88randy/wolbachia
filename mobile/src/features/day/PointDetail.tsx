import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import type { M06Model } from "./use-m-06.ts";
import { TaskSummary } from "./TaskSummary.tsx";
import { PointHistory } from "./PointHistory.tsx";
import { PointDirections } from "./PointDirections.tsx";
import { TaskCaptureAction } from "./TaskCaptureAction.tsx";
export function PointDetail({ model }: { readonly model: M06Model }) {
  const t = useT();
  const row = model.selected;
  if (row === null) return null;
  return (
    <Card>
      <TaskSummary row={row} />
      <PointDirections model={model} />
      <PointHistory task={row.task} />
      <TaskCaptureAction task={row.task} />
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
