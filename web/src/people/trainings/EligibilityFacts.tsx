import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import styles from "./trainings.module.css";
export function EligibilityFacts({ result }: { result: Schemas["EligibilityRead"] }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <dl className={styles.facts}>
      <dt>{t("trainings.field.action")}</dt>
      <dd>{result.action}</dd>
      <dt>{t("trainings.field.requirementVersion")}</dt>
      <dd>{result.requirement_version_id ?? t("trainings.state.unconfigured")}</dd>
      <dt>{t("trainings.field.validFrom")}</dt>
      <dd>{result.valid_from ? format(result.valid_from) : t("trainings.state.unavailable")}</dd>
      <dt>{t("trainings.field.validTo")}</dt>
      <dd>{result.valid_until ? format(result.valid_until) : t("trainings.state.unavailable")}</dd>
      <dt>{t("trainings.field.nextChange")}</dt>
      <dd>
        {result.next_change_at ? format(result.next_change_at) : t("trainings.state.unavailable")}
      </dd>
      <dt>{t("trainings.field.trainingVersion")}</dt>
      <dd>{result.training_version_ids.join(", ") || t("trainings.state.unavailable")}</dd>
      <dt>{t("trainings.field.certificate")}</dt>
      <dd>{result.certification_ids.join(", ") || t("trainings.state.unavailable")}</dd>
    </dl>
  );
}
