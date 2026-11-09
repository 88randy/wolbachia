import { View } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ClosedSupplySummary } from "./ClosedSupplySummary.tsx";
import type { CloseDraft } from "./domain.ts";
export function ClosedSummary({ draft }: { readonly draft: CloseDraft }) {
  const styles = useStyles(createShiftStyles);
  const t = useT();
  return (
    <View style={styles.group}>
      <AppText>{t("mobile.shiftClose.odometer")}</AppText>
      <AppText variant="bodyStrong">{draft.odometer}</AppText>
      <AppText>{draft.note}</AppText>
      <AppText>{t("mobile.shiftClose.pending")}</AppText>
      {draft.pending.map((point) => (
        <AppText key={point.taskId}>{point.pointCode}</AppText>
      ))}
      {draft.supplies.map((supply) => (
        <ClosedSupplySummary key={supply.eventId} supply={supply} />
      ))}
    </View>
  );
}
