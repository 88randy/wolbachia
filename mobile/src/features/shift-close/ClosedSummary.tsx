import { View } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { SupplyEquation } from "./SupplyEquation.tsx";
import type { CloseDraft } from "./domain.ts";
export function ClosedSummary({ draft }: { readonly draft: CloseDraft }) {
  const styles = useStyles(createShiftStyles);
  const t = useT();
  return <View style={styles.group}>
    <AppText>{t("mobile.shiftClose.odometer")}</AppText><AppText variant="mono">{draft.odometer}</AppText>
    <AppText>{draft.note}</AppText>
    <AppText>{t("mobile.shiftClose.pending")}</AppText>
    {draft.pending.map((point) => <AppText key={point.taskId}>{point.pointCode}</AppText>)}
    {draft.supplies.map((supply) => <View key={supply.eventId} style={styles.group}>
      {supply.source.frame.map((line) => <SupplyEquation key={line.assignment_line_id} line={line} />)}
      {supply.returns.map((line) => <Card key={line.receiptLineId}><AppText>{t("mobile.shiftClose.returnQuantity")}</AppText><AppText variant="mono">{line.returned}</AppText></Card>)}
      {supply.shrinkage?.map((line) => <Card key={line.receiptLineId}><AppText>{t("mobile.shiftClose.shrinkageQuantity")}</AppText><AppText variant="mono">{line.quantity}</AppText><AppText>{line.reason}</AppText></Card>)}
      {supply.photos?.map((photo) => <AppText key={photo.id} variant="mono">{photo.id}</AppText>)}
    </View>)}
  </View>;
}
