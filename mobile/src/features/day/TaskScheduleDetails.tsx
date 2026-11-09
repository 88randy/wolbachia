import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import type { DayTask } from "./domain.ts";

/** Dates and distances share tabular mono without changing their labels or order. */
export function TaskScheduleDetails({ row }: { readonly row: DayTask }) {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <AppText isMonospace>
        {new Date(row.task.date).toLocaleDateString(locale, { timeZone: "UTC" })}
      </AppText>
      {row.distanceM === null ? null : (
        <AppText isMonospace>
          {t("mobile.day.distance", { distance: Math.round(row.distanceM).toLocaleString(locale) })}
        </AppText>
      )}
    </>
  );
}
