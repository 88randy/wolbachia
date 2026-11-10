import { useState } from "react";
import { useOnlineStatus } from "../../shell/use-online-status";
import { useTransferWrite } from "./use-transfer-write";
import type { TransferRecordProps } from "./TransferRecord";
/** Capture remains in the current form memory; only the writer freezes its first submitted body. */
export function useTransferDispatch({ scope, transfer, memory }: TransferRecordProps) {
  const [signature, setSignature] = useState(memory.signature ?? "");
  const write = useTransferWrite(scope, memory);
  const online = useOnlineStatus();
  const verifySignature = (id: string) => {
    setSignature(id);
    memory.signature = id;
  };
  const send = () => {
    void write.send({
      id: transfer.id,
      action: "dispatch",
      body: {
        command_id: crypto.randomUUID(),
        expected_revision: transfer.revision,
        signature_upload_id: signature,
      },
    });
  };
  const canSubmit =
    Boolean(signature) && online && transfer.state === "prepared" && !write.isFrozen;
  return { write, verifySignature, send, canSubmit };
}
