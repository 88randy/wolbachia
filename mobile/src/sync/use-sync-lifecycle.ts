import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { AppState } from "react-native";

import { observeSyncSession } from "./observe-sync-session.ts";
import { observeConnectivity } from "./connectivity.ts";

import { useServices } from "../app/services-context.ts";
import { throttleRefresh } from "../features/day/refresh-throttle.ts";

/** [ASSUMPTION] Technical spacing between foreground-triggered passes. */
const FOREGROUND_SYNC_GAP_MS = 30_000;

/**
 * Starts the sync engine and keeps it informed: connectivity changes, the app coming back to the
 * foreground and the session changing all ask for a pass. None of it waits for the network.
 *
 * The worker runs while the app process is alive. Syncing with the app closed would need a
 * background task (WorkManager through `expo-background-task`); that is not part of #6.
 */
export function useSyncLifecycle(): void {
  const { auth, engine, tokens } = useServices();
  useEffect(() => {
    const stopTokens = observeSyncSession(engine, tokens);
    const stopNet = observeConnectivity(NetInfo.addEventListener, { auth, engine });
    void engine.start();
    // A prompt, the camera or a notification also bring the app back to the front; those must not
    // start a pass each time.
    const onForeground = throttleRefresh(
      () => engine.requestSync(),
      Date.now,
      FOREGROUND_SYNC_GAP_MS,
    );
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") void onForeground();
    });
    return () => {
      stopNet();
      appState.remove();
      stopTokens();
    };
  }, [auth, engine, tokens]);
}
