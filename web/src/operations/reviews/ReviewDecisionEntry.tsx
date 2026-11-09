import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import type { Review } from "./review-query";
import { reviewActionKey, reviewStateKey } from "./review-labels";
import { ReviewDecisionEvidence } from "./ReviewDecisionEvidence";
import styles from "./reviews.module.css";
export function ReviewDecisionEntry({ decision }: { decision: Review["timeline"][number] }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <li>
      <p>
        {t(reviewActionKey(decision.kind))} · {format(decision.created_at)} ·{" "}
        {decision.created_by ?? t("reviews.workspace.unknown")}
      </p>
      <p className={decision.decision_state === "voided" ? styles.voided : undefined}>
        {decision.reason}
      </p>
      <p>
        {t(reviewStateKey(decision.decision_state))} ·{" "}
        {t(decision.audit_only ? "reviews.workspace.auditOnly" : "reviews.workspace.operational")}
      </p>
      {decision.incident_id && (
        <p>{t("reviews.workspace.incidentReceipt", { id: decision.incident_id })}</p>
      )}
      <ReviewDecisionEvidence decision={decision} />
    </li>
  );
}
