import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { nameOrDash, useCenterName, useQuadrantName } from "../../lookups/use-reference-names";
import type { NoticePolicy } from "./notice-query";
import styles from "./evaluations.module.css";
export function NoticePolicyFacts({ policy }: { policy: NoticePolicy }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const centerName = useCenterName();
  const quadrantName = useQuadrantName();
  const entries = [
    ["evaluations.history.revision", policy.revision],
    ["evaluations.field.center", centerName(policy.center_id)],
    [
      "evaluations.field.quadrant",
      policy.quadrant_id === null
        ? t("evaluations.notice.noQuadrant")
        : quadrantName(policy.quadrant_id),
    ],
    ["evaluations.notice.recipient", nameOrDash(policy.recipient_name)],
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
