import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useServices } from "../../app/services-context.ts";
import { ScannerSession } from "./scanner-session.ts";

/** Lock, background and unmount retire every native/result continuation before another can start. */
export function useScannerLifecycle() {
  const { auth, tokens } = useServices();
  const session = useRef(new ScannerSession()).current;
  const revision = useRef(0);
  const [isCameraVisible, setCamera] = useState(false);
  const stop = useCallback(() => {
    revision.current++;
    session.cancel();
    setCamera(false);
  }, [session]);
  useEffect(() => subscribeLifecycle({ auth, tokens, stop }), [auth, tokens, stop]);
  const lease = () => {
    const original = revision.current;
    return () =>
      original === revision.current &&
      auth.getSnapshot().phase === "unlocked" &&
      AppState.currentState === "active";
  };
  const permissionContext = () =>
    lease()() ? { eventId: "scanner", sessionKey: String(revision.current) } : null;
  return { session, stop, lease, permissionContext, isCameraVisible, setCamera };
}

function subscribeLifecycle(
  input: Pick<ReturnType<typeof useServices>, "auth" | "tokens"> & { readonly stop: () => void },
) {
  const { auth, tokens, stop } = input;
  const remove = [auth.subscribe(stop), tokens.subscribe(stop)];
  const app = AppState.addEventListener("change", (state) => {
    if (state !== "active") stop();
  });
  return () => {
    stop();
    app.remove();
    for (const unsubscribe of remove) unsubscribe();
  };
}
