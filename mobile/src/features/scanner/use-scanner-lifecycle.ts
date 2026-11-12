import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useServices } from "../../app/services-context.ts";
import { ScannerSession } from "./scanner-session.ts";

/**
 * Lock and background hide the camera; any session or token change only retires the scan in
 * flight (the camera keeps reading, so nothing is lost silently). Unmount retires everything.
 */
export function useScannerLifecycle() {
  const { auth, tokens } = useServices();
  const session = useRef(new ScannerSession()).current;
  const revision = useRef(0);
  const [isCameraVisible, setCamera] = useState(false);
  const retire = useCallback(() => {
    revision.current++;
    session.cancel();
  }, [session]);
  const stop = useCallback(() => {
    retire();
    setCamera(false);
  }, [retire]);
  useEffect(() => subscribeLifecycle({ auth, tokens, stop, retire }), [auth, tokens, stop, retire]);
  const lease = () => {
    const original = revision.current;
    return () =>
      original === revision.current &&
      auth.getSnapshot().phase === "unlocked" &&
      AppState.currentState === "active";
  };
  /** The camera may only be shown while the app is unlocked and in front. */
  const canShowCamera = () => auth.getSnapshot().phase === "unlocked" && isAppActive();
  return { session, stop, lease, canShowCamera, isCameraVisible, setCamera };
}

function isAppActive(): boolean {
  return AppState.currentState === "active";
}

function subscribeLifecycle(
  input: Pick<ReturnType<typeof useServices>, "auth" | "tokens"> & {
    readonly stop: () => void;
    readonly retire: () => void;
  },
) {
  const { auth, tokens, stop, retire } = input;
  const remove = [
    auth.subscribe(() => {
      if (auth.getSnapshot().phase === "unlocked") retire();
      else stop();
    }),
    tokens.subscribe(retire),
  ];
  const app = AppState.addEventListener("change", (state) => {
    if (state !== "active") stop();
  });
  return () => {
    stop();
    app.remove();
    for (const unsubscribe of remove) unsubscribe();
  };
}
