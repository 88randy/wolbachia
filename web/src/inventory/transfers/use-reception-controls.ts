import { useOnlineStatus } from "../../shell/use-online-status";
import type { Transfer } from "./transfer-query";
import type { useTransferReception } from "./use-transfer-reception";
/** Quantities and signatures wait for a committed response; offline and terminal states cannot submit. */
export function useReceptionControls(
  transfer: Transfer,
  model: ReturnType<typeof useTransferReception>,
) {
  const isOnline = useOnlineStatus();
  const isLocked = model.write.isFrozen || model.write.isBusy;
  const hasEvidence =
    Boolean(model.draft.signature) && model.missing.every((line) => line.evidence_ids.length > 0);
  const isScanBlocked = isLocked || !isOnline || transfer.state !== "dispatched";
  return { isLocked, isScanBlocked, canReceive: hasEvidence && !isScanBlocked };
}
