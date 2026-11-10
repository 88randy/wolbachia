import { Card } from "../../ui/Card";
import { useDocumentTitle } from "../../shell/use-document-title";
import { useCan } from "../../session/use-can";
import { TransferStatus } from "./TransferStatus";
import { TransferHistory } from "./TransferHistory";
import { TransferDispatch } from "./TransferDispatch";
import { TransferReception } from "./TransferReception";
import type { Transfer, TransferScope } from "./transfer-query";
import type { TransferMemory } from "./use-transfer-write";
export interface TransferRecordProps {
  scope: TransferScope;
  transfer: Transfer;
  memory: TransferMemory;
}
export function TransferRecord(props: TransferRecordProps) {
  const can = useCan();
  const { transfer, memory } = props;
  useDocumentTitle(transfer.code);
  const action =
    memory.command?.action ??
    (transfer.state === "prepared"
      ? "dispatch"
      : transfer.state === "dispatched"
        ? "receive"
        : null);
  return (
    <>
      <Card
        title={transfer.code}
        headingLevel={1}
        actions={<TransferStatus state={transfer.state} />}
      >
        {can("transfer.dispatch") && action === "dispatch" && <TransferDispatch {...props} />}
        {can("transfer.receive") && action === "receive" && <TransferReception {...props} />}
        <TransferHistory transfer={transfer} />
      </Card>
    </>
  );
}
