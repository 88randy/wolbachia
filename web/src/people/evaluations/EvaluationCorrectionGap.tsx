import { useTranslation } from "react-i18next";
import { useCan } from "../../session/use-can";
import { Button } from "../../ui/Button";
export function EvaluationCorrectionGap() {
  const { t } = useTranslation();
  const can = useCan();
  if (!can("evaluation.create") || !can("evaluation.read")) return null;
  return (
    <>
      <Button aria-disabled>{t("evaluations.history.correction")}</Button>
      <p>{t("evaluations.history.correctionGap")}</p>
    </>
  );
}
