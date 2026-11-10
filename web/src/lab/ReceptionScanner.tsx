import { useTranslation } from "react-i18next";
import type { ReceptionActions } from "./use-reception-command";
import { useReceptionScanner } from "./use-reception-scanner";
import { ReceptionScanForm } from "./ReceptionScanForm";
import { ReceptionRecoveryNotice } from "./ReceptionRecoveryNotice";
import { ReceptionFeedback } from "./ReceptionFeedback";
import styles from "./reception.module.css";
/** Keep the field mounted and editable; typed next codes survive an in-flight result. */
export function ReceptionScanner({ actions }: { actions: ReceptionActions }) {
  const { t } = useTranslation();
  const scanner = useReceptionScanner(actions);
  return (
    <section className={styles.scanner} aria-label={t("labReception.scan.label")}>
      <ReceptionScanForm actions={actions} scanner={scanner} />
      <p role="status">
        {actions.isBusy && <span>{t("labReception.scan.busy")} · </span>}
        {t("labReception.scan.queued")} · {scanner.pendingCount}
      </p>
      <ReceptionFeedback result={actions.result} code={actions.result?.subject} />
      {actions.isReviewRequired && (
        <ReceptionRecoveryNotice actions={actions} onReview={scanner.review} />
      )}
    </section>
  );
}
