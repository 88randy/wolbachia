import { View } from "react-native";
import { AppText } from "../../ui/AppText.tsx";
import { CalendarLegend } from "./CalendarLegend.tsx";
import { CalendarNotices } from "./CalendarNotices.tsx";
import { DayRouteAction } from "./DayRouteAction.tsx";
import { MonthGrid } from "./MonthGrid.tsx";
import { MonthNav } from "./MonthNav.tsx";
import type { CalendarScreenModel } from "./use-calendar-screen.ts";

type HeaderModel = Pick<
  CalendarScreenModel,
  | "view"
  | "hasError"
  | "retry"
  | "selection"
  | "grid"
  | "day"
  | "route"
  | "monthTitle"
  | "openInbox"
  | "openRoute"
>;

/** P33 list header: notices, month navigation, grid, legend and the selected day's route. */
export function CalendarHeader({ model }: { readonly model: HeaderModel }) {
  const { selection, grid, day } = model;
  return (
    <View className="gap-4 pb-1">
      <CalendarNotices
        hasError={model.hasError}
        isUnavailable={model.view !== null && !model.view.isHistoryAvailable}
        onRetry={() => void model.retry()}
        onOpenInbox={model.openInbox}
      />
      <View className="px-3">
        <MonthNav
          title={model.monthTitle}
          onPrevious={selection.previous}
          onNext={selection.next}
        />
      </View>
      <MonthGrid weeks={grid.cells} weekdays={grid.weekdays} onSelect={selection.select} />
      <View className="gap-4 px-3">
        <CalendarLegend />
        {day ? (
          <AppText variant="h2" accessibilityRole="header">
            {grid.format.dayDate(day.date)}
          </AppText>
        ) : null}
        <DayRouteAction route={model.route} onOpen={model.openRoute} />
      </View>
    </View>
  );
}
