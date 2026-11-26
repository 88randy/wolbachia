import { Clock } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { KIT_ICON_STROKE } from "../../ui/kit-styles.ts";
import type { DayCellModel } from "./calendar-cells.ts";

type DayCellProps = {
  readonly cell: Extract<DayCellModel, { readonly kind: "day" }>;
  readonly onSelect: (date: string) => void;
};

const FRAME: Readonly<Record<DayCellProps["cell"]["state"], string>> = {
  selected: "border-action bg-tint",
  today: "border-line-strong bg-surface",
  idle: "border-transparent bg-surface",
};

/**
 * A day kept on the phone: number plus shape markers (filled dot = activity, clock ring =
 * pending). The spoken label carries the date and the counts; markers are decorative.
 */
export function DayCell({ cell, onSelect }: DayCellProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cell.label}
      accessibilityState={{ selected: cell.state === "selected" }}
      onPress={() => {
        onSelect(cell.date);
      }}
      className={`min-h-12 flex-1 items-center justify-center gap-1 rounded-xl border-2 py-1 ${FRAME[cell.state]}`}
    >
      <AppText variant={cell.state === "idle" ? "body" : "bodyStrong"} isMonospace>
        {cell.number}
      </AppText>
      <View
        className="min-h-3 flex-row items-center gap-1"
        importantForAccessibility="no-hide-descendants"
      >
        {cell.hasActivity ? <View className="h-2 w-2 rounded-full bg-ink" /> : null}
        {cell.hasPending ? (
          <Clock color={theme.color.status.warning.fg} size={12} strokeWidth={KIT_ICON_STROKE} />
        ) : null}
      </View>
    </Pressable>
  );
}
