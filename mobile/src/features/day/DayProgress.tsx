import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { DayEmptyState } from "./DayEmptyState.tsx";
import type { M06Model } from "./use-m-06.ts";
export function DayProgress({ model }: { readonly model: M06Model }) {
  const t = useT();
  return (
    <>
      <DayEmptyState model={model} />
      <AppText>
        {t("mobile.day.progress", { reviewed: model.reviewed, total: model.total })}
      </AppText>
    </>
  );
}
