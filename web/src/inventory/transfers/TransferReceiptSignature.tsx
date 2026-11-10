import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import { Button } from "../../ui/Button";
import { TransferEvidence } from "./TransferEvidence";
import type { TransferScope } from "./transfer-query";
import type { useTransferReception } from "./use-transfer-reception";
interface SignatureProps {
  scope: TransferScope;
  model: ReturnType<typeof useTransferReception>;
  isBlocked: boolean;
  canSubmit: boolean;
}
export function TransferReceiptSignature({ scope, model, isBlocked, canSubmit }: SignatureProps) {
  const { t } = useTranslation();
  return (
    <>
      <InlineNotice tone="warning">{t("transfers.write.receiveRule")}</InlineNotice>
      <TransferEvidence
        scope={scope}
        label={t("transfers.signature.receiver")}
        isBlocked={isBlocked}
        onVerified={model.verifySignature}
      />
      <Button loading={model.write.isBusy} disabled={!canSubmit} onClick={model.send}>
        {t("transfers.action.receive")}
      </Button>
    </>
  );
}
