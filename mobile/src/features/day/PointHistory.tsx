import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import type { AssignedTask } from "./types.ts";
import { HISTORY_KEYS } from "./presentation.ts";
/** Unknown server summary codes are not shown as user copy. */
export function PointHistory({ task }: { readonly task: AssignedTask }) {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <AppText variant="button">{t("mobile.day.history")}</AppText>
      {task.history.length === 0 ? <AppText>{t("mobile.day.historyEmpty")}</AppText> : null}
      {task.history.map((entry, index) => (
        <AppText key={`${entry.date}-${String(index)}`}>
          {t("mobile.day.historyEntry", {
            date: new Date(entry.date).toLocaleDateString(locale, { timeZone: "UTC" }),
            summary: t(HISTORY_KEYS[entry.summary_code] ?? "mobile.day.historyUnknown"),
          })}
        </AppText>
      ))}
    </>
  );
}
