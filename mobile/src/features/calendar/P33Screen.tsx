import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { CalendarDayList } from "./CalendarDayList.tsx";
import { useCalendarScreen } from "./use-calendar-screen.ts";

/**
 * P33 (#373): month grid as the list header, then the selected day: its tasks first, then what
 * the courier did, newest first. Offline: everything is read from the phone.
 */
export function P33Screen() {
  const model = useCalendarScreen();
  const t = useT();
  return (
    <ScreenScaffold
      tab="calendar"
      isScrollable={false}
      header={<AppHeader title={t("mobile.calendar.title")} onBack={null} />}
    >
      <CalendarDayList model={model} />
    </ScreenScaffold>
  );
}
