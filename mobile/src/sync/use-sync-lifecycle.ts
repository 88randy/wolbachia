import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { AppState } from "react-native";

import { useServices } from "../app/services-context.ts";

/**
 * Starts the sync engine and keeps it informed: connectivity changes, the app coming back to the
 * foreground and the session changing all ask for a pass. None of it waits for the network.
 *
 * The worker runs while the app process is alive. Syncing with the app closed would need a
 * background task (WorkManager through `expo-background-task`); that is not part of #6.
 */
export function useSyncLifecycle(): void {
  const { engine, tokens } = useServices();
  useEffect(() => {
    void engine.start();
    // `isConnected` is null until the first reading: unknown counts as online.
    const stopNet = NetInfo.addEventListener((state) => {
      engine.setOnline(state.isConnected !== false);
    });
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") void engine.requestSync();
    });
    const stopTokens = tokens.subscribe(() => {
      engine.notifyConditionsChanged();
    });
    return () => {
      stopNet();
      appState.remove();
      stopTokens();
    };
  }, [engine, tokens]);
}
