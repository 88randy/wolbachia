import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { nameOrDash } from "../lookups/use-reference-names";
import styles from "./shifts.module.css";

export function ShiftDecisionMetadata({ decision }: { decision: Schemas["ShiftDecision"] }) {
  const { t } = useTranslation();
  return (
    <dl className={styles.facts}>
      <div>
        <dt>{t("shift.field.author")}</dt>
        <dd>
          {decision.created_by
            ? nameOrDash(decision.created_by_name)
            : t("shift.field.unavailable")}
        </dd>
      </div>
    </dl>
  );
}
