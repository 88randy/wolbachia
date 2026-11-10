import { useTranslation } from "react-i18next";
import { SECTIONS } from "./evaluation-domain";
import { SECTION_KEYS } from "./evaluation-labels";
export function RubricWeights({ weights }: { weights: Record<string, unknown> }) {
  const { t } = useTranslation();
  return (
    <>
      {SECTIONS.map((key) => (
        <div key={key}>
          <dt>{t(SECTION_KEYS[key])}</dt>
          <dd>
            {String(weights[key])}
            {t("evaluations.rubric.percent")}
          </dd>
        </div>
      ))}
    </>
  );
}
