import { useRef, useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import type { SessionGuard } from "../../session/use-session-guard";
import type { WriteOutcome } from "./permit-write";
import { usePermitWrite } from "./use-permit-write";

type Send = (guard: SessionGuard) => Promise<{ response: Response; error?: unknown }>;

/**
 * One explicit submit at a time. A failed or conflicting write keeps the draft and says why; a
 * duplicate code is reported apart so the form can mark that field. Nothing is replayed.
 */
export function usePermitSubmit(onSaved: () => void, conflictKey: MessageKey) {
  const write = usePermitWrite();
  const busy = useRef(false);
  const [isBusy, setBusy] = useState(false);
  const [failure, setFailure] = useState<MessageKey>();
  const [isDuplicate, setDuplicate] = useState(false);

  const settle = (outcome: WriteOutcome) => {
    busy.current = false;
    setBusy(false);
    if (outcome.kind === "saved") onSaved();
    else if (outcome.kind === "duplicate") setDuplicate(true);
    else if (outcome.kind === "failed") setFailure(outcome.key);
    else if (outcome.kind === "conflict") setFailure(conflictKey);
  };

  const run = (send: Send) => {
    if (busy.current) return;
    busy.current = true;
    setBusy(true);
    setFailure(undefined);
    setDuplicate(false);
    void write(send).then(settle);
  };

  return { isBusy, failure, isDuplicate, run };
}
