import { useEffect } from "react";
import { missingLines, receptionBody } from "./transfer-reception";
import { useTransferWrite } from "./use-transfer-write";
import type { TransferRecordProps } from "./TransferRecord";
import { useReceptionDraft } from "./use-reception-draft";
import { useReceptionScanner } from "./use-reception-scanner";
export function useTransferReception({ scope, transfer, memory }: TransferRecordProps) {
  const reception = useReceptionDraft(memory, transfer);
  const scanner = useReceptionScanner(transfer, reception);
  const write = useTransferWrite(scope, memory);
  useEffect(() => {
    if (write.result) scanner.scanner.current?.focus();
  }, [write.result, scanner.scanner]);
  const send = () => {
    void write.send({
      id: transfer.id,
      action: "receive",
      body: receptionBody(transfer, reception.draft),
    });
  };
  return {
    ...reception,
    ...scanner,
    write,
    send,
    missing: missingLines(transfer, reception.draft),
  };
}
