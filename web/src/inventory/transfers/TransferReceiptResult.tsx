import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { TransferWriteFeedback } from "./TransferWriteFeedback";
import type { useTransferReception } from "./use-transfer-reception";
export function TransferReceiptResult({
  model,
  transferId,
}: {
  model: ReturnType<typeof useTransferReception>;
  transferId: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <TransferWriteFeedback write={model.write} onRetry={model.send} />
      {model.write.result?.discrepancy_id && (
        <Link to="/inventory/discrepancies" search={{ transfer: transferId }}>
          {t("transfers.action.discrepancies")}
        </Link>
      )}
    </>
  );
}
