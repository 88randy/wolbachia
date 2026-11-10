import { useEffect, useRef, useState } from "react";
import type { ReceptionActions } from "./use-reception-command";
import type { ReceptionCommand } from "./reception-command";
type Scan = Extract<ReceptionCommand, { kind: "bag" }>;
/** Each Enter freezes one scan; only an unattempted FIFO head can start a write. */
function useScanQueueOwner(revision: number) {
  const [isRunning, setRunning] = useState(false);
  const running = useRef<symbol | null>(null);
  const previousRevision = useRef(revision);
  useEffect(() => {
    if (previousRevision.current !== revision) {
      running.current = null;
      setRunning(false);
    }
    previousRevision.current = revision;
  }, [revision]);
  return { running, isRunning, setRunning };
}
function startQueuedScan(
  owner: ReturnType<typeof useScanQueueOwner>,
  actions: ReceptionActions,
  head: Scan,
) {
  const token = Symbol();
  owner.running.current = token;
  owner.setRunning(true);
  actions.setResult(null);
  void actions.submit(head).finally(() => {
    if (owner.running.current !== token) return;
    owner.running.current = null;
    owner.setRunning(false);
  });
}
export function useReceptionScanQueue(actions: ReceptionActions) {
  const [pending, setPending] = useState<Scan[]>([]);
  const owner = useScanQueueOwner(actions.revision);
  useEffect(() => {
    const head = pending[0];
    if (
      !head ||
      owner.running.current ||
      actions.isBusy ||
      actions.isReviewRequired ||
      !actions.canSubmit
    )
      return;
    setPending((scans) => scans.slice(1));
    startQueuedScan(owner, actions, head);
  }, [pending, actions, owner]);
  const enqueue = (code: string) => {
    const scan: Scan = { kind: "bag", code, command_id: crypto.randomUUID() };
    setPending((scans) => [...scans, scan]);
  };
  return { enqueue, pendingCount: pending.length };
}
