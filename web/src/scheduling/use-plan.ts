import { useQueries, useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useMemo } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { useMe } from "../session/use-me";
import { useSessionIdentity } from "../session/use-session-identity";
import { MAX_PAGE, scheduleOptions } from "./scheduling-queries";
import { daysOfWeek, todayIn, weekStartOf } from "./week-dates";

/** Week, day and courier of the plan, read from the address bar; one query per day of the week. */
export function usePlan() {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const me = useMe();
  const search: Record<string, string | undefined> = useSearch({ strict: false });
  const convention = me.organization?.epi_week ?? "iso";
  const timeZone = me.organization?.timezone ?? "UTC";
  const today = todayIn(timeZone);
  const week = weekStartOf(search["week"] ?? today, convention);
  const days = daysOfWeek(week);
  const requestedDay = search["day"];
  const day =
    requestedDay && days.includes(requestedDay)
      ? requestedDay
      : days.includes(today)
        ? today
        : week;
  const courier = search["courier"];

  const perDay = useQueries({
    queries: days.map((value) =>
      scheduleOptions(client, identity, { week, day: value, pageSize: 1 }),
    ),
  });
  const loads = useMemo(() => {
    const table = new Map<string, Map<string, number>>();
    perDay.forEach((query, index) => {
      const date = days[index];
      for (const row of query.data?.load ?? []) {
        if (row.courier === null || date === undefined) continue;
        const byDay = table.get(row.courier) ?? new Map<string, number>();
        byDay.set(date, row.load);
        table.set(row.courier, byDay);
      }
    });
    return table;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `days` is derived from `week`.
  }, [perDay.map((query) => query.dataUpdatedAt).join(","), week]);

  const selected = courier ?? [...loads.keys()].find((id) => (loads.get(id)?.get(day) ?? 0) > 0);
  const dayOptions = scheduleOptions(client, identity, {
    week,
    day,
    ...(selected ? { courier: selected } : {}),
    pageSize: MAX_PAGE,
  });
  const dayTasks = useQuery({
    ...dayOptions,
    enabled: dayOptions.enabled && selected !== undefined,
  });

  return {
    week,
    days,
    day,
    today,
    courier: selected,
    loads,
    isLoading: perDay.some((query) => query.isPending),
    isError: perDay.some((query) => query.isError),
    refetch: () => {
      perDay.forEach((query) => void query.refetch());
      void dayTasks.refetch();
    },
    target: perDay.find((query) => query.data)?.data?.target ?? 0,
    revision: dayTasks.data?.revision ?? perDay.find((query) => query.data)?.data?.revision ?? 0,
    tasks: dayTasks.data?.results ?? [],
    dayLoads: dayTasks.data?.load ?? [],
    isTasksLoading: dayTasks.isPending,
    totalTasks: dayTasks.data?.count ?? 0,
  };
}

export type Plan = ReturnType<typeof usePlan>;
