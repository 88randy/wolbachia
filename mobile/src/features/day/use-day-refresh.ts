import { scheduleDueRefresh } from "./due-refresh.ts";
import { throttleRefresh } from "./refresh-throttle.ts";
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useMemo } from "react";
import { AppState } from "react-native";
/**
 * Screen entry, reconnect and foreground return refresh the bundle; callers preserve cached UI on
 * failure. Automatic triggers are spaced out so an idle phone does not download the bundle again
 * every few seconds; a manual pull-to-refresh calls `refresh` directly and is never throttled.
 */
export function useDayRefresh(
  refresh: () => Promise<void>,
  nextChangeAt: string | null,
  isEnabled = true,
) {
  const auto = useMemo(() => throttleRefresh(refresh, Date.now), [refresh]);
  useEffect(() => {
    if (!isEnabled) return;
    void auto();
    let wasConnected = true;
    const stop = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected !== false;
      if (isConnected && !wasConnected) void auto();
      wasConnected = isConnected;
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void auto();
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [auto, isEnabled]);
  useDueRefresh(auto, isEnabled ? nextChangeAt : null);
}
function useDueRefresh(refresh: () => Promise<void>, nextChangeAt: string | null) {
  useEffect(() => {
    if (nextChangeAt === null) return;
    return scheduleDueRefresh({
      dueAt: nextChangeAt,
      now: Date.now,
      refresh: () => {
        void refresh();
      },
      schedule: (callback, delayMs) => {
        const timer = setTimeout(callback, delayMs);
        return () => {
          clearTimeout(timer);
        };
      },
    });
  }, [refresh, nextChangeAt]);
}
