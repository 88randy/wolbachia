import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { TaskCard } from "./TaskCard.tsx";
import { hasCoverage } from "./map-coverage.ts";
import type { DayTask } from "./domain.ts";
import type { M06Model } from "./use-m-06.ts";
export function TaskSection({
  title,
  rows,
  model,
}: {
  readonly title: MessageKey;
  readonly rows: readonly DayTask[];
  readonly model: M06Model;
}) {
  const t = useT();
  if (rows.length === 0) return null;
  return (
    <>
      <AppText variant="button" accessibilityRole="header">
        {t(title)}
      </AppText>
      {rows.map((row) => (
        <TaskCard
          key={row.task.id}
          row={row}
          isCovered={hasCoverage(row.task.quadrant_id, model.state?.map ?? { kind: "unavailable" })}
          onSelect={() => {
            void model.select(row.task);
          }}
        />
      ))}
    </>
  );
}
