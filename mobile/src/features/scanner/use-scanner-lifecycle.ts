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
      (AppState.currentState ?? "active") === "active";
  };
  /**
   * The camera shows whenever the app is unlocked. Going to the background hides it through the
   * AppState listener; the AppState reading is not trusted here, because a wrong or missing one
   * left the preview hidden with no message (placement entry point).
   */
  const canShowCamera = () => auth.getSnapshot().phase === "unlocked";
  return { session, stop, lease, canShowCamera, isCameraVisible, setCamera };
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
    // The camera view stays mounted: the system releases the camera in the background and takes it
    // back by itself. Tearing the view down here made it flap on every short pause.
    if (state !== "active") retire();
  });
  return () => {
    stop();
    app.remove();
    for (const unsubscribe of remove) unsubscribe();
  };
}
