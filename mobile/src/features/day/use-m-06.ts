import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useServices } from "../../app/services-context.ts";
import { buildDay } from "./domain.ts";
import { DayViewController, dayViewPhase } from "./day-view-controller.ts";
import type { AssignedTask } from "./types.ts";
import { useDayLocation } from "./use-day-location.ts";
import { useDayRefresh } from "./use-day-refresh.ts";

function useDayView() {
  const { day, engine, auth } = useServices();
  const scope = useDayScope();
  const controller = useMemo(() => {
    const view = new DayViewController(day);
    if (scope === null) view.stop();
    return view;
  }, [day, scope]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const session = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  useEffect(() => {
    if (scope === null) return;
    controller.start();
    void controller.load();
    const update = () => {
      void controller.load();
    };
    const stopEngine = engine.subscribe(update);
    return () => {
      controller.stop();
      stopEngine();
    };
  }, [controller, day, engine, scope]);
  return { day, controller, snapshot, isUnlocked: session.phase === "unlocked" };
}
function useDayScope(): string | null {
  const { tokens } = useServices();
  const credentials = useSyncExternalStore(tokens.subscribe, tokens.getSnapshot);
  return credentials.status === "active" && credentials.pair !== null
    ? JSON.stringify([credentials.sessionId, credentials.origin])
    : null;
}
function useDisplayClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return now;
}

type DayState = ReturnType<typeof useDayView>["snapshot"]["state"];
function isShiftOpen(state: DayState): boolean {
  return state?.isShiftOpen ?? false;
}
function nextChangeAt(state: DayState): string | null {
  return state?.meta?.next_change_at ?? null;
}
function useDayProgress(state: DayState, location: ReturnType<typeof useDayLocation>, now: Date) {
  const progress = buildDay({ tasks: state?.tasks ?? [], work: state?.work ?? [], location, now });
  const selected = progress.tasks.find((row) => row.task.id === state?.navigation?.pointId) ?? null;
  return { ...progress, selected };
}

/** Auth owns lock visibility; cached content survives refresh without claiming a successful read. */
export function useM06() {
  const { day, controller, snapshot, isUnlocked } = useDayView();
  const now = useDisplayClock();
  const location = useDayLocation(day.location, isUnlocked && isShiftOpen(snapshot.state));
  useDayRefresh(controller.refresh, nextChangeAt(snapshot.state), isUnlocked);
  const progress = useDayProgress(snapshot.state, location, now);
  return {
    ...snapshot,
    ...progress,
    now,
    phase: dayViewPhase(snapshot),
    refresh: controller.refresh,
    read: controller.load,
    retryMap: controller.retryMap,
    retryAction: controller.retryAction,
    select: (task: AssignedTask) => controller.run(() => day.select(task.id)),
    navigate: (task: AssignedTask) => controller.run(() => day.navigate(task.id)),
    clearSelection: () => controller.run(() => day.clearSelection()),
  };
}
export type M06Model = ReturnType<typeof useM06>;
