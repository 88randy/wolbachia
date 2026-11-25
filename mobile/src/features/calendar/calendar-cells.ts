import type { Translate } from "../../i18n/translate.ts";
import { dayNumber } from "./calendar-format.ts";
import type { CalendarFormat } from "./calendar-format.ts";
import { PENDING } from "./domain.ts";
import type { CalendarDay, CalendarMonth } from "./domain.ts";

/** One grid position. Explicit variants instead of boolean props (composition rule). */
export type DayCellModel =
  | { readonly kind: "spacer"; readonly date: string }
  | {
      readonly kind: "outside";
      readonly date: string;
      readonly number: string;
      readonly label: string;
    }
  | {
      readonly kind: "day";
      readonly date: string;
      readonly number: string;
      readonly label: string;
      readonly state: "selected" | "today" | "idle";
      readonly hasActivity: boolean;
      readonly hasPending: boolean;
    };

interface CellInput {
  readonly month: CalendarMonth;
  readonly days: ReadonlyMap<string, CalendarDay>;
  readonly today: string;
  readonly selected: string;
  readonly t: Translate;
  readonly format: CalendarFormat;
}

function cellOf(date: string, input: CellInput): DayCellModel {
  const day = input.days.get(date);
  if (date.slice(0, 7) !== input.month.month || day === undefined) return { kind: "spacer", date };
  const number = dayNumber(date);
  const spoken = input.format.dayDate(date);
  if (!day.isInWindow)
    return {
      kind: "outside",
      date,
      number,
      label: input.t("mobile.calendar.outsideWindowLabel", { date: spoken }),
    };
  const activities = day.items.filter((item) => item.source !== "task").length;
  const pending = day.items.filter((item) => PENDING.includes(item.status)).length;
  const state = date === input.selected ? "selected" : date === input.today ? "today" : "idle";
  return {
    kind: "day",
    date,
    number,
    label: input.t("mobile.calendar.dayLabel", { date: spoken, activities, pending }),
    state,
    hasActivity: day.hasActivity,
    hasPending: day.hasPending,
  };
}

/** The month's weeks as cells: other-month dates are spacers, days the phone lacks are disabled. */
export function monthCells(input: CellInput): readonly (readonly DayCellModel[])[] {
  return input.month.weeks.map((week) => week.map((date) => cellOf(date, input)));
}
