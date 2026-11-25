import { useMemo, useState } from "react";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { DEFAULT_TIME_ZONE } from "../../sync/format-time.ts";
import { useStartTask } from "../day/use-start-task.ts";
import { monthCells } from "./calendar-cells.ts";
import { calendarFormat } from "./calendar-format.ts";
import type { CalendarDay } from "./domain.ts";
import type { CalendarView } from "./service.ts";
import { useCalendar } from "./use-calendar.ts";
import { dayRouteOf, useDayLines } from "./use-day-lines.ts";
import type { DayRoute } from "./use-day-lines.ts";

interface Picked {
  readonly date: string;
  readonly month: string;
}

/** Selected date and shown month; both follow `today` (also after midnight) until the courier picks. */
function useSelection(view: CalendarView | null) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const today = view === null ? null : { date: view.today, month: view.today.slice(0, 7) };
  const { date, month } = picked ?? today ?? { date: null, month: null };
  const months = view?.monthWeeks ?? [];
  const index = months.findIndex((candidate) => candidate.month === month);
  const go = (offset: number) => {
    const target = index < 0 ? undefined : months[index + offset];
    return target === undefined || date === null
      ? null
      : () => {
          setPicked({ date, month: target.month });
        };
  };
  return {
    date,
    month: months[index] ?? null,
    previous: go(-1),
    next: go(1),
    select: (value: string) => {
      setPicked({ date: value, month: value.slice(0, 7) });
    },
  };
}

function useGrid(view: CalendarView | null, selection: ReturnType<typeof useSelection>) {
  const t = useT();
  const locale = useLocale();
  const timeZone = view?.timeZone ?? DEFAULT_TIME_ZONE;
  const format = useMemo(() => calendarFormat(locale, timeZone), [locale, timeZone]);
  const days = useMemo(
    () => new Map<string, CalendarDay>((view?.days ?? []).map((day) => [day.date, day])),
    [view],
  );
  const { month, date } = selection;
  const cells =
    view === null || month === null || date === null
      ? []
      : monthCells({ month, days, today: view.today, selected: date, t, format });
  const weekdays = (month?.weeks[0] ?? []).map((day) => ({ date: day, name: format.weekday(day) }));
  return { format, days, cells, weekdays, timeZone };
}

function routeFor(
  day: CalendarDay | undefined,
  today: string | null,
  lines: ReturnType<typeof useDayLines>,
): DayRoute {
  if (day === undefined || today === null || !day.isInWindow || day.date > today) return "hidden";
  const has = (kind: string) => day.items.some((item) => item.kind === kind);
  return dayRouteOf(lines, day.date === today && has("shift.open") && !has("shift.close"));
}

/** P33 screen model: grid cells, the selected day's rows, its route state and the actions. */
export function useCalendarScreen() {
  const data = useCalendar();
  const selection = useSelection(data.view);
  const grid = useGrid(data.view, selection);
  const { push } = useNavigation();
  const start = useStartTask();
  const day = selection.date === null ? undefined : grid.days.get(selection.date);
  const today = data.view?.today ?? null;
  const isPast = day !== undefined && today !== null && day.isInWindow && day.date <= today;
  const lines = useDayLines(isPast ? day.date : null, grid.timeZone);
  return {
    ...data,
    selection,
    grid,
    day,
    route: routeFor(day, today, lines),
    monthTitle: selection.month ? grid.format.monthTitle(selection.month.month) : "",
    openInbox: () => {
      push({ name: "inbox" });
    },
    openRoute: () => {
      if (day !== undefined) push({ name: "calendarTrack", date: day.date });
    },
    startTask: start,
  };
}
export type CalendarScreenModel = ReturnType<typeof useCalendarScreen>;
