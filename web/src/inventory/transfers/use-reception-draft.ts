import { useRef, useState } from "react";
import { appendScan, prefilledDraft, setLineReceived } from "./transfer-reception";
import type { ReceptionDraft } from "./transfer-reception";
import type { TransferMemory } from "./use-transfer-write";
import type { Transfer } from "./transfer-query";
/** Synchronous canonical writes preserve every proof/scan even before React flushes a batch. */
export function useReceptionDraft(memory: TransferMemory, transfer: Transfer) {
  const [draft, setDraft] = useState<ReceptionDraft>(
    () => memory.reception ?? prefilledDraft(transfer),
  );
  const current = useRef(draft);
  const commit = (next: ReceptionDraft) => {
    current.current = next;
    memory.reception = next;
    setDraft(next);
  };
  const verifySignature = (signature: string) => {
    commit({ ...current.current, signature });
  };
  const verifyPhoto = (lineId: string, id: string) => {
    commit({ ...current.current, photos: { ...current.current.photos, [lineId]: id } });
  };
  const recordScan = (transfer: Transfer, input: Parameters<typeof appendScan>[2]) => {
    const next = appendScan(transfer, current.current, input);
    commit(next.draft);
    return next.result;
  };
  const setReceived = (transfer: Transfer, lineId: string, quantity: string) => {
    const next = setLineReceived(transfer, current.current, { lineId, quantity });
    if (next.result === "accepted") commit(next.draft);
  };
  return { draft, verifySignature, verifyPhoto, recordScan, setReceived };
}
