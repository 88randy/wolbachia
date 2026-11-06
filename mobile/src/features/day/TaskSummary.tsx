import { useT } from "../../i18n/I18nProvider.tsx";
import { TaskScheduleDetails } from "./TaskScheduleDetails.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Badge } from "../../ui/Badge.tsx";
import type { DayTask } from "./domain.ts";
import { ACTION_KEYS, markerState } from "./presentation.ts";
export function TaskSummary({ row }: { readonly row: DayTask }) {
  const t = useT();
  const state = markerState(row);
  return (
    <>
      <AppText variant="button" isMonospace>
        {row.task.point_code}
      </AppText>
      {row.task.risk === "high" ? (
        <Badge tone="critical" icon="alert" label={t("mobile.day.highRisk")} />
      ) : null}
      {row.task.block_code === undefined ? null : (
        <AppText tone="secondary">{t("mobile.day.block", { code: row.task.block_code })}</AppText>
      )}
      <AppText>{t(ACTION_KEYS[row.task.action])}</AppText>
      <TaskScheduleDetails row={row} />
      <Badge tone={state.tone} icon={state.icon} label={t(state.key)} />
      {row.delivery === "none" ? null : (
        <AppText>
          {t(row.delivery === "phone" ? "mobile.day.phoneSaved" : "mobile.day.serverReceived")}
        </AppText>
      )}
      {row.isKept ? <Badge tone="warning" icon="alert" label={t("mobile.day.kept")} /> : null}
    </>
  );
}
