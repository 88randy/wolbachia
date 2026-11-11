import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { useCan } from "../session/use-can";
import { useMe } from "../session/use-me";
import { useSessionIdentity } from "../session/use-session-identity";
import { cycleSteps, isWaitingForOthers, nextStep, weekFacts } from "./cycle-status";
import type { CycleFacts } from "./cycle-status";
import {
  assignmentsOptions,
  interventionsOptions,
  risksOptions,
  weekLoadsOptions,
} from "./scheduling-queries";
import { daysOfWeek, todayIn, weekStartOf } from "./week-dates";
import { DEFAULT_TIME_ZONE } from "../format/time-zone";

/** How the current epi week is going, step by step: what the home screen shows on each card. */
export function useCycleStatus() {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const me = useMe();
  const can = useCan();
  const today = todayIn(me.organization?.timezone ?? DEFAULT_TIME_ZONE);
  const week = weekStartOf(today, me.organization?.epi_week ?? "iso");
  const days = daysOfWeek(week);
  const canRead = can("schedule.read");
  const risk = useQuery({ ...risksOptions(client, identity, week, 1, 1), enabled: canRead });
  const assignments = useQuery({ ...assignmentsOptions(client, identity), enabled: canRead });
  const loads = useQuery({ ...weekLoadsOptions(client, identity, week, days), enabled: canRead });
  const interventions = useQuery({
    ...interventionsOptions(client, identity, 1, 1),
    enabled: can("intervention.read"),
  });
  const rows = assignments.data?.results ?? [];
  const facts: CycleFacts = {
    riskCount: risk.data?.count ?? 0,
    quadrantCount: rows.length,
    unassignedCount: rows.filter((row) => row.courier === null).length,
    interventionCount: interventions.data?.count ?? 0,
    ...weekFacts(days, loads.data ?? [], today),
  };
  const steps = cycleSteps(facts);
  const abilities = { canImport: can("risk_import.apply"), canManage: can("schedule.manage") };
  return {
    week,
    days,
    facts,
    steps,
    next: nextStep(steps, abilities),
    isWaiting: isWaitingForOthers(steps, abilities),
    isLoading: canRead && (risk.isPending || assignments.isPending || loads.isPending),
    isError: risk.isError || assignments.isError || loads.isError,
    refetch: () => {
      void risk.refetch();
      void assignments.refetch();
      void loads.refetch();
    },
  };
}
