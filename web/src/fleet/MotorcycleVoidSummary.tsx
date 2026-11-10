import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../format/use-format-date-time";
import { nameOrDash } from "../lookups/use-reference-names";
import type { Motorcycle } from "./fleet-query";
import { useFleetAuthor } from "./use-fleet-author";
import styles from "./fleet.module.css";
export function MotorcycleVoidSummary({ motorcycle }: { motorcycle: Motorcycle }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const author = useFleetAuthor();
  if (motorcycle.voided_at === null) return null;
  return (
    <>
      <dt>{t("fleet.summary.voidedAt")}</dt>
      <dd className={styles.timestamp}>{format(motorcycle.voided_at)}</dd>
      <dt>{t("fleet.summary.voidedBy")}</dt>
      <dd>
        {motorcycle.voided_by === null ? author(null) : nameOrDash(motorcycle.voided_by_name)}
      </dd>
      <dt>{t("common.fields.voidReason")}</dt>
      <dd>{motorcycle.void_reason}</dd>
    </>
  );
}
