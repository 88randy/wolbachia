import { useTranslation } from "react-i18next";
import { TransferScanner } from "./TransferScanner";
import { ReceptionLine } from "./ReceptionLine";
import { useTransferReception } from "./use-transfer-reception";
import type { TransferRecordProps } from "./TransferRecord";
import { useReceptionControls } from "./use-reception-controls";
import { TransferReceiptSignature } from "./TransferReceiptSignature";
import { TransferReceiptResult } from "./TransferReceiptResult";

/** Receive line by line: everything starts as "arrived as expected"; the person fixes the rest. */
export function TransferReception(props: TransferRecordProps) {
  const { t } = useTranslation();
  const model = useTransferReception(props);
  const controls = useReceptionControls(props.transfer, model);
  return (
    <section className="flex min-w-0 flex-col gap-5">
      <p className="m-0 text-sm text-ink-2">{t("transfers.receive.intro")}</p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {props.transfer.lines.map((line) => (
          <ReceptionLine
            key={line.id}
            line={line}
            scope={props.scope}
            model={model}
            transfer={props.transfer}
            isBlocked={controls.isScanBlocked}
          />
        ))}
      </ul>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-action-strong">
          {t("transfers.receive.extras")}
        </summary>
        <div className="mt-3 max-w-md">
          <TransferScanner model={model} isBlocked={controls.isScanBlocked} />
        </div>
      </details>
      <div className="flex min-w-0 flex-col gap-3 border-t border-line pt-4">
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
