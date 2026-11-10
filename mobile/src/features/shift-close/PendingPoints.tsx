import { View } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { PendingPointCard } from "./PendingPointCard.tsx";
import type { M14Model } from "./use-m-14.ts";
export function PendingPoints({ model }: { readonly model: M14Model }) {
  const styles = useStyles(createShiftStyles);
  const t = useT();
  const draft = model.state?.draft;
  if (!draft) return null;
  return (
    <View style={styles.group}>
      <AppText variant="button">{t("mobile.shiftClose.pending")}</AppText>
      {!(model.state?.pending ?? []).length ? (
        <AppText>{t("mobile.shiftClose.noPending")}</AppText>
      ) : null}
      {(model.state?.pending ?? []).map((point) => (
        <PendingPointCard
          key={point.taskId}
          model={model}
          point={point}
          dispositions={draft.dispositions}
        />
      ))}
    </View>
  );
}
