import { useT } from "../../i18n/I18nProvider.tsx";
import { AppFlatList } from "../../ui/AppFlatList.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { CalendarDayEmpty } from "./CalendarDayEmpty.tsx";
import { CalendarHeader } from "./CalendarHeader.tsx";
import { CalendarRow } from "./CalendarRow.tsx";
import { useCalendarScreen } from "./use-calendar-screen.ts";

/**
 * P33 (#373): month grid as the list header, then the selected day: its tasks first, then what
 * the courier did, newest first. Offline: everything is read from the phone.
 */
export function P33Screen() {
  const model = useCalendarScreen();
  const t = useT();
  const isToday = model.day !== undefined && model.day.date === model.view?.today;
  return (
    <ScreenScaffold
      tab="calendar"
      isScrollable={false}
      header={<AppHeader title={t("mobile.calendar.title")} onBack={null} />}
    >
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
        ListEmptyComponent={<CalendarDayEmpty view={model.view} hasError={model.hasError} />}
      />
    </ScreenScaffold>
  );
}
