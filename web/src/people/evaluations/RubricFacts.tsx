import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { InlineNotice } from "../../ui/InlineNotice";
import { readRubric } from "./evaluation-domain";
import { RubricWeights } from "./RubricWeights";
import type { RubricVersion } from "./evaluation-query";
import styles from "./evaluations.module.css";
export function RubricFacts({ version }: { version: RubricVersion }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const rubric = readRubric(version);
  if (!rubric)
    return <InlineNotice tone="warning">{t("evaluations.rubric.unconfigured")}</InlineNotice>;
  return (
    <dl className={styles.facts}>
      <dt>{t("evaluations.rubric.version")}</dt>
      <dd>{version.version}</dd>
      <RubricWeights weights={rubric.weights} />
      <dt>{t("evaluations.rubric.threshold")}</dt>
      <dd>{rubric.threshold}</dd>
      <dt>{t("evaluations.rubric.effective")}</dt>
      <dd>{format(version.effective_from)}</dd>
      <dt>{t("evaluations.rubric.checks")}</dt>
      <dd>{rubric.checks.join(", ")}</dd>
    </dl>
  );
}
