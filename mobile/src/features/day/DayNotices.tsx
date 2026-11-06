import { DayErrors } from "./DayErrors.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { M06Model } from "./use-m-06.ts";
export function DayNotices({ model }: { readonly model: M06Model }) {
  const t = useT();
  const unreadable = model.state?.meta?.unreadable_rows ?? 0;
  const kept = model.tasks.filter((row) => row.isKept).map((row) => row.task.point_code);
  return (
    <>
      <DayErrors model={model} />
      {unreadable === 0 ? null : (
        <Notice
          tone="warning"
          icon="alert"
          message={t("mobile.day.unreadable", { count: unreadable })}
        />
      )}
      {kept.length === 0 ? null : (
        <Notice
          tone="warning"
          icon="alert"
          message={t("mobile.day.keptNotice", { codes: kept.join(", ") })}
        />
      )}
    </>
  );
}
