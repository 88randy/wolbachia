import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useMemo } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { useMe } from "../session/use-me";
import { useSessionIdentity } from "../session/use-session-identity";
import { MAX_PAGE, scheduleOptions, weekLoadsOptions } from "./scheduling-queries";
import type { DayLoad } from "./scheduling-queries";
import { daysOfWeek, todayIn, weekStartOf } from "./week-dates";

/** Courier -> day -> number of points. */
function loadTable(days: readonly string[], perDay: readonly DayLoad[] | undefined) {
  const table = new Map<string, Map<string, number>>();
  perDay?.forEach((entry, index) => {
    const date = days[index];
    for (const row of entry.loads) {
      if (row.courier === null || date === undefined) continue;
      const byDay = table.get(row.courier) ?? new Map<string, number>();
      byDay.set(date, row.load);
      table.set(row.courier, byDay);
    }
  });
  return table;
}

/** Week, day and courier of the plan, read from the address bar. */
export function usePlan() {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const me = useMe();
  const search: Record<string, string | undefined> = useSearch({ strict: false });
  const today = todayIn(me.organization?.timezone ?? "UTC");
  const week = weekStartOf(search["week"] ?? today, me.organization?.epi_week ?? "iso");
  const days = daysOfWeek(week);
  const requestedDay = search["day"];
  const fallbackDay = days.includes(today) ? today : week;
  const day = requestedDay && days.includes(requestedDay) ? requestedDay : fallbackDay;

  const weekQuery = useQuery(weekLoadsOptions(client, identity, week, days));
  const loads = useMemo(
    () => loadTable(days, weekQuery.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `days` is derived from `week`.
    [weekQuery.data, week],
  );
  const selected =
    search["courier"] ?? [...loads.keys()].find((id) => (loads.get(id)?.get(day) ?? 0) > 0);
  const dayOptions = scheduleOptions(client, identity, {
    week,
    day,
    ...(selected ? { courier: selected } : {}),
    pageSize: MAX_PAGE,
  });
  const dayTasks = useQuery({
    ...dayOptions,
    enabled: dayOptions.enabled && weekQuery.isSuccess && selected !== undefined,
  });
  const first = weekQuery.data?.[0];
  return {
    week,
    days,
    day,
    today,
    courier: selected,
    loads,
    isLoading: weekQuery.isPending,
    isError: weekQuery.isError,
    refetch: () => {
      void weekQuery.refetch();
      void dayTasks.refetch();
    },
    target: first?.target ?? 0,
    revision: dayTasks.data?.revision ?? first?.revision ?? 0,
    tasks: dayTasks.data?.results ?? [],
    isTasksLoading: dayTasks.isPending && selected !== undefined,
  };
}

export type Plan = ReturnType<typeof usePlan>;
