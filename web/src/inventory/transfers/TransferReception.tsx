import { TransferScanner } from "./TransferScanner";
import { ReceptionLine } from "./ReceptionLine";
import { useTransferReception } from "./use-transfer-reception";
import type { TransferRecordProps } from "./TransferRecord";
import styles from "./transfers.module.css";
import { useReceptionControls } from "./use-reception-controls";
import { TransferReceiptSignature } from "./TransferReceiptSignature";
import { TransferReceiptResult } from "./TransferReceiptResult";
export function TransferReception(props: TransferRecordProps) {
  const model = useTransferReception(props);
  const controls = useReceptionControls(props.transfer, model);
  return (
    <section className={styles.reception}>
      <div className={styles.capture}>
        <TransferScanner model={model} isBlocked={controls.isScanBlocked} />
        <ul className={styles.lines}>
          {props.transfer.lines.map((line) => (
            <ReceptionLine key={line.id} line={line} scope={props.scope} model={model} />
          ))}
        </ul>
      </div>
      <div className={styles.capture}>
        <TransferReceiptSignature
          scope={props.scope}
          model={model}
          isBlocked={controls.isLocked}
          canSubmit={controls.canReceive}
        />
        <TransferReceiptResult model={model} transferId={props.transfer.id} />
      </div>
    </section>
  );
}
