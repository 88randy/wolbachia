import { View } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { ReturnField } from "./ReturnField.tsx";
import { ShrinkageField } from "./ShrinkageField.tsx";
import type { ReconcileDraft } from "./domain.ts";
import type { M14Model } from "./use-m-14.ts";

interface Props {
  readonly model: M14Model;
  readonly supply: ReconcileDraft;
  readonly lineId: string;
  readonly sourceId: string;
}
function replaceSupply(model: M14Model, next: ReconcileDraft): void {
  model.edit({
    supplies:
      model.state?.draft?.supplies.map((item) => (item.eventId === next.eventId ? next : item)) ??
      [],
  });
}
export function ReceiptLineForm({ model, supply, lineId, sourceId }: Props) {
  const styles = useStyles(createShiftStyles);
  const onChange = (next: ReconcileDraft) => {
    replaceSupply(model, next);
  };
  return (
    <View style={styles.group}>
      <ReturnField
        supply={supply}
        lineId={lineId}
        sourceId={sourceId}
        disabled={model.isBusy}
        onChange={onChange}
      />
      <ShrinkageField model={model} supply={supply} lineId={lineId} sourceId={sourceId} />
    </View>
  );
}
