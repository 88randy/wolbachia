import { View } from "react-native";
import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { TrainingNotices } from "./TrainingNotices.tsx";
import { trainingDate } from "./presentation.ts";
import type { useTraining } from "./use-training.ts";

export function TrainingHeader({ model }: { readonly model: ReturnType<typeof useTraining> }) {
  const t = useT();
  const locale = useLocale();
  const { source } = model;
  return (
    <View className="gap-3 pb-1">
      <AppText variant="body" tone="secondary">
        {t("trainings.mobile.qualificationHint")}
      </AppText>
      {source === null && !model.hasLocalError ? <Skeleton /> : null}
      <TrainingNotices model={model} />
      {source?.records ? (
        <AppText variant="caption" tone="secondary">
          {`${t("trainings.mobile.downloadedAt")} · ${trainingDate(source.records.fetchedAt, locale, model.timeZone)}`}
        </AppText>
      ) : null}
    </View>
  );
}
