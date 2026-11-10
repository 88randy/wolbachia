import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { nameOrDash } from "../../lookups/use-reference-names";
import type { Review } from "./review-query";

export function ReviewDecisionEvidence({ decision }: { decision: Review["timeline"][number] }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const receipt = decision.effect_receipt;
  return (
    <>
      {receipt && (
        <p>
          {t("reviews.workspace.effectConfirmed", {
            author: nameOrDash(receipt.created_by_name),
            time: format(receipt.created_at),
          })}
        </p>
      )}
      {decision.evidence_ids.length > 0 && (
        <p>{t("reviews.workspace.evidenceCount", { count: decision.evidence_ids.length })}</p>
      )}
    </>
  );
}
