import { useTranslation } from "react-i18next";
import type { Review } from "./review-query";
import styles from "./reviews.module.css";
export function ReviewDecisionEvidence({ decision }: { decision: Review["timeline"][number] }) {
  const { t } = useTranslation();
  return (
    <>
      {decision.effect_receipt && (
        <details>
          <summary>{t("reviews.workspace.receipt")}</summary>
          <pre className={styles.snapshot}>{JSON.stringify(decision.effect_receipt, null, 2)}</pre>
        </details>
      )}
      <details>
        <summary>{t("reviews.workspace.decisionEvidence")}</summary>
        <pre className={styles.snapshot}>{JSON.stringify(decision.evidence_ids, null, 2)}</pre>
      </details>
    </>
  );
}
