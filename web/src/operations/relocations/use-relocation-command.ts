import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { useSessionGuard } from "../../session/use-session-guard";
import type { RelocationScope } from "./relocations-query";
import { runRelocationCommand } from "./relocation-command";
import type { RelocationCommand, RelocationFailure } from "./relocation-command";
/** A session revision interrupts this attempt; reauthentication never resends it. */
export function useRelocationCommand(scope: RelocationScope) {
  const begin = useSessionGuard();
  const cache = useQueryClient();
  const lock = useRef(false);
  const revision = useRef(scope.identity.revision);
  const [isBusy, setBusy] = useState(false);
  const [failure, setFailure] = useState<RelocationFailure | null>(null);
  const [receipt, setReceipt] = useState<Schemas["RelocationDecisionResult"] | null>(null);
  useEffect(() => {
    if (revision.current !== scope.identity.revision && lock.current) {
      lock.current = false;
      setBusy(false);
      setFailure({ code: "uncertain", isConflict: false });
    }
    revision.current = scope.identity.revision;
  }, [scope.identity.revision]);
  const context = { scope, begin, cache, lock, failure, setBusy, setFailure, setReceipt };
  return {
    isBusy,
    failure,
    receipt,
    execute: (command: RelocationCommand) => runRelocationCommand(context, command),
    clearFailure: () => {
      setFailure(null);
    },
  };
}
