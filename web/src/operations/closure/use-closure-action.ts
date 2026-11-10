import { useRef, useState } from "react";
import { useOnlineStatus } from "../../shell/use-online-status";
import { isClosureReady } from "./closure-policy";
import type { Quadrant, Readiness } from "./closure-policy";
import type { useClosureWrite } from "./use-closure-write";
export interface ClosureActionProps {
  quadrant: Quadrant;
  readiness: Readiness;
  write: ReturnType<typeof useClosureWrite>;
  isCurrent: boolean;
}
/** Freeze the evidence actually reviewed; a refreshed projection cannot replace a pending command. */
export function useClosureAction({ quadrant, readiness, write, isCurrent }: ClosureActionProps) {
  const isOnline = useOnlineStatus();
  const reviewed = useRef<Readiness | null>(null);
  const [hasChanged, setChanged] = useState(false);
  const canClose = isCurrent && isOnline && isClosureReady(readiness, quadrant) && !write.isBusy;
  const freeze = () => {
    reviewed.current = readiness;
    setChanged(false);
  };
  const confirm = () => {
    if (!canClose || reviewed.current !== readiness) {
      setChanged(true);
      return;
    }
    void write.close({ id: quadrant.id, revision: readiness.revision });
  };
  return { isOnline, hasChanged, canClose, freeze, confirm };
}
