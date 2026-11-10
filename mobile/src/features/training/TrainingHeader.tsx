import { View } from "react-native";
import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import type { useTraining } from "./use-training.ts";
import { trainingDate } from "./presentation.ts";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createTrainingStyles } from "./styles.ts";
import { TrainingNotices } from "./TrainingNotices.tsx";

export function TrainingHeader({ model }: { readonly model: ReturnType<typeof useTraining> }) {
  const t = useT(),
    locale = useLocale(),
    styles = useStyles(createTrainingStyles);
  const { source } = model;
  return (
    <View style={styles.group}>
      <AppText>{t("trainings.mobile.qualificationHint")}</AppText>
      {source === null && !model.hasLocalError ? <Skeleton /> : null}
      <TrainingNotices model={model} />
      {source?.records ? (
        <AppText variant="caption">
          {t("trainings.mobile.downloadedAt")}
          {" · "}
          {trainingDate(source.records.fetchedAt, locale, model.timeZone)}
        </AppText>
      ) : null}
    </View>
  );
}
