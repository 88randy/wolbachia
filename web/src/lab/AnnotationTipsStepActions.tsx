import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { useAnnotationHelp } from "./use-annotation-help";
import styles from "./annotation-help.module.css";

export function AnnotationTipsStepActions({
  guide,
}: {
  guide: ReturnType<typeof useAnnotationHelp>;
}) {
  const { t } = useTranslation();
  const previous = () => {
    guide.setStep(Math.max(0, guide.step - 1));
  };
  const next = () => {
    if (guide.step === 2) guide.changeOpen(false);
    else guide.setStep(guide.step + 1);
  };
  return (
    <div className={styles.steps}>
      <Button variant="secondary" size="sm" aria-disabled={guide.step === 0} onClick={previous}>
        {t("labAnnotation.tips.previous")}
      </Button>
      <Button size="sm" onClick={next}>
        {t(guide.step === 2 ? "labAnnotation.tips.close" : "labAnnotation.tips.next")}
      </Button>
    </div>
  );
}
