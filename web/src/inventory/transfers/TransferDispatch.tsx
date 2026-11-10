import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import { TransferEvidence } from "./TransferEvidence";
import { TransferWriteFeedback } from "./TransferWriteFeedback";
import { useTransferDispatch } from "./use-transfer-dispatch";
import type { TransferRecordProps } from "./TransferRecord";
import styles from "../inventory.module.css";
export function TransferDispatch(props: TransferRecordProps) {
  const { t } = useTranslation();
  const { write, verifySignature, send, canSubmit } = useTransferDispatch(props);
  return (
    <section className={styles.form}>
      <TransferEvidence
        scope={props.scope}
        label={t("transfers.signature.sender")}
        isBlocked={write.isBusy || write.isFrozen}
        onVerified={verifySignature}
      />
      <InlineNotice tone="info">{t("transfers.write.dispatchRule")}</InlineNotice>
      <Button loading={write.isBusy} disabled={!canSubmit} onClick={send}>
        {t("transfers.action.dispatch")}
      </Button>
      <TransferWriteFeedback write={write} onRetry={send} />
    </section>
  );
}
