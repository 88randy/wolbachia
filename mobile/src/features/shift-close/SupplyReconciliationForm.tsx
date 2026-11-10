import { View } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { ReceiptLineForm } from "./ReceiptLineForm.tsx";
import { SupplyEquation } from "./SupplyEquation.tsx";
import type { ReconcileDraft } from "./domain.ts";
import type { M14Model } from "./use-m-14.ts";

function receiptLines(supply: ReconcileDraft, canReconcile: boolean | undefined) {
  if (!canReconcile) return [];
  return supply.source.receipts
    .filter((receipt) => !receipt.voided)
    .flatMap((receipt) =>
      receipt.lines.map((line) => ({ lineId: line.id, sourceId: receipt.source_event_id })),
    );
}
interface Props {
  readonly model: M14Model;
  readonly supply: ReconcileDraft;
}
export function SupplyReconciliationForm({ model, supply }: Props) {
  const styles = useStyles(createShiftStyles);
  return (
    <View style={styles.group}>
      <AppText variant="caption">{supply.source.id}</AppText>
      {supply.source.frame.map((line) => (
        <SupplyEquation key={line.assignment_line_id} line={line} />
      ))}
      {receiptLines(supply, model.state?.canReconcile).map((line) => (
        <ReceiptLineForm key={line.lineId} model={model} supply={supply} {...line} />
      ))}
    </View>
  );
}
