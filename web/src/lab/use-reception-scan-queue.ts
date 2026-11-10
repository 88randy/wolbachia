import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
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
interface QueuedScanContext {
  owner: ReturnType<typeof useScanQueueOwner>;
  actions: ReceptionActions;
  head: Scan;
  setPending: Dispatch<SetStateAction<Scan[]>>;
}
function acceptQueuedScan(context: QueuedScanContext, token: symbol) {
  context.owner.running.current = token;
  context.owner.setRunning(true);
  context.setPending((scans) =>
    scans[0]?.command_id === context.head.command_id ? scans.slice(1) : scans,
  );
  context.actions.setResult(null);
}
function startQueuedScan(context: QueuedScanContext) {
  const { owner, actions, head } = context;
  const token = Symbol();
  void actions
    .submit(head, () => {
      acceptQueuedScan(context, token);
    })
    .finally(() => {
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
    startQueuedScan({ owner, actions, head, setPending });
  }, [pending, actions, owner]);
  const enqueue = (code: string) => {
    const scan: Scan = { kind: "bag", code, command_id: crypto.randomUUID() };
    setPending((scans) => [...scans, scan]);
  };
  return { enqueue, pendingCount: pending.length };
}
