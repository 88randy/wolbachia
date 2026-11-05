import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { M06Model } from "./use-m-06.ts";
export function DayProgress({ model }: { readonly model: M06Model }) {
  const t = useT();
  return (
    <>
      {model.total === 0 ? (
        <Notice tone="info" icon="list" message={t("mobile.day.empty")} />
      ) : null}
      {model.total > 0 && model.reviewed === model.total ? (
        <Notice tone="info" icon="check" message={t("mobile.day.ready")} />
      ) : null}
      <AppText>
        {t("mobile.day.progress", { reviewed: model.reviewed, total: model.total })}
      </AppText>
    </>
  );
}
