import { View } from "react-native";
import { AppText } from "../../ui/AppText.tsx";
import type { DayCellModel } from "./calendar-cells.ts";
import { DayCell } from "./DayCell.tsx";
import { OutsideDayCell } from "./OutsideDayCell.tsx";

interface MonthGridProps {
  readonly weeks: readonly (readonly DayCellModel[])[];
  /** Narrow weekday names in the organization's week order, keyed by a date of that column. */
  readonly weekdays: readonly { readonly date: string; readonly name: string }[];
  readonly onSelect: (date: string) => void;
}

/**
 * P33 month grid: 7 columns from the epi-week start. No column gap: on a 360 dp phone with the
 * 4 dp list gutter each cell stays above 48 dp wide.
 */
export function MonthGrid({ weeks, weekdays, onSelect }: MonthGridProps) {
  return (
    <View className="gap-1">
      <View className="flex-row" importantForAccessibility="no-hide-descendants">
        {weekdays.map(({ date, name }) => (
          <AppText key={date} variant="caption" tone="secondary" className="flex-1 text-center">
            {name}
          </AppText>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]?.date} className="flex-row">
          {week.map((cell) =>
            cell.kind === "day" ? (
              <DayCell key={cell.date} cell={cell} onSelect={onSelect} />
            ) : cell.kind === "outside" ? (
              <OutsideDayCell key={cell.date} cell={cell} />
            ) : (
              <View key={cell.date} className="min-h-12 flex-1" />
            ),
          )}
        </View>
      ))}
    </View>
  );
}
