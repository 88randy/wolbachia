import { AppFlatList } from "../../ui/AppFlatList.tsx";
import { CalendarDayEmpty } from "./CalendarDayEmpty.tsx";
import { CalendarHeader } from "./CalendarHeader.tsx";
import { CalendarRow } from "./CalendarRow.tsx";
import type { CalendarScreenModel } from "./use-calendar-screen.ts";

/** The grid as list header, then the selected day's rows (tasks first, activity newest first). */
export function CalendarDayList({ model }: { readonly model: CalendarScreenModel }) {
  const isToday = model.day !== undefined && model.day.date === model.view?.today;
  return (
    <AppFlatList
      data={model.day?.items ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <CalendarRow
          item={item}
          time={model.grid.format.time(item.time)}
          onStart={isToday ? model.startTask : null}
          onOpenInbox={model.openInbox}
        />
      )}
      className="flex-1"
      contentContainerClassName="gap-3 px-1 pb-8 pt-4"
      ListHeaderComponent={<CalendarHeader model={model} />}
      ListEmptyComponent={
        <CalendarDayEmpty
          view={model.view}
          date={model.day?.date ?? null}
          hasError={model.hasError}
        />
      }
    />
  );
}
