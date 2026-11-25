import { View } from "react-native";
import { AppText } from "../../ui/AppText.tsx";
import type { DayCellModel } from "./calendar-cells.ts";

/** A day the phone does not keep: disabled, and its spoken label says why (never "no activity"). */
export function OutsideDayCell({
  cell,
}: {
  readonly cell: Extract<DayCellModel, { readonly kind: "outside" }>;
}) {
  return (
    <View
      accessible
      accessibilityLabel={cell.label}
      accessibilityState={{ disabled: true }}
      className="min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-dashed border-line py-1"
    >
      <AppText variant="body" tone="tertiary" isMonospace>
        {cell.number}
      </AppText>
    </View>
  );
}
