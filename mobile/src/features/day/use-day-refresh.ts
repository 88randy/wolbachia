import { scheduleDueRefresh } from "./due-refresh.ts";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { AppState } from "react-native";
/** Screen entry, reconnect and foreground return refresh the bundle; callers preserve cached UI on failure. */
export function useDayRefresh(refresh: () => Promise<void>, nextChangeAt: string | null) {
  useEffect(() => {
    void refresh();
    let wasConnected = true;
    const stop = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected !== false;
      if (isConnected && !wasConnected) void refresh();
      wasConnected = isConnected;
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [refresh]);
  useDueRefresh(refresh, nextChangeAt);
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
