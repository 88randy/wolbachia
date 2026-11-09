import { View } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { ClosedSupplyReturns } from "./ClosedSupplyReturns.tsx";
import { ClosedSupplyShrinkage } from "./ClosedSupplyShrinkage.tsx";
import { SupplyEquation } from "./SupplyEquation.tsx";
import type { ReconcileDraft } from "./domain.ts";

export function ClosedSupplySummary({ supply }: { readonly supply: ReconcileDraft }) {
  const styles = useStyles(createShiftStyles);
  return (
    <View style={styles.group}>
      {supply.source.frame.map((line) => (
        <SupplyEquation key={line.assignment_line_id} line={line} />
      ))}
      <ClosedSupplyReturns supply={supply} />
      <ClosedSupplyShrinkage supply={supply} />
      {supply.photos?.map((photo) => (
        <AppText key={photo.id} variant="caption">
          {photo.id}
        </AppText>
      ))}
    </View>
  );
}
