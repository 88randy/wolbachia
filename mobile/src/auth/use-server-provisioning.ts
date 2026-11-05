import { useEffect, useState, useSyncExternalStore } from "react";

import { useServices } from "../app/services-context.ts";

/** Presentation follows the domain guard; every actual mutation rechecks under the auth queue. */
export function useServerProvisioning(): boolean {
  const { server, auth, tokens, engine } = useServices();
  const hasPair = useSyncExternalStore(tokens.subscribe, tokens.hasSyncSession);
  const { profile } = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  const { counts } = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [canChange, setCanChange] = useState(false);
  useEffect(() => {
    let isCurrent = true;
    void server.canChange().then(
      (allowed) => {
        if (isCurrent) setCanChange(allowed);
      },
      () => {
        if (isCurrent) setCanChange(false);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [server, hasPair, profile, counts.pending, counts.sending, counts.error]);
  return (
    !hasPair &&
    profile === null &&
    counts.pending + counts.sending + counts.error === 0 &&
    canChange
  );
}
