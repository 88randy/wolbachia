import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import type { NoticePolicy } from "./notice-query";
import styles from "./evaluations.module.css";
export function NoticePolicyFacts({ policy }: { policy: NoticePolicy }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const entries = [
    ["evaluations.notice.policyId", policy.id],
    ["evaluations.history.revision", policy.revision],
    ["evaluations.field.center", policy.center_id],
    ["evaluations.field.quadrant", policy.quadrant_id ?? t("evaluations.notice.noQuadrant")],
    ["evaluations.notice.recipient", policy.recipient_membership_id],
    ["evaluations.history.recorded", format(policy.created_at)],
  ] as const;
  return (
    <dl className={styles.facts}>
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt>{t(key)}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
