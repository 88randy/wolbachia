import { useTranslation } from "react-i18next";
import { AnnotationEggGuide } from "./AnnotationEggGuide";
import styles from "./annotation-help.module.css";

const STEPS = ["recognize", "tools", "method"] as const;
const TOOL_TIPS = ["boxes", "points", "mouse"] as const;
const METHOD_TIPS = ["sweep", "edges", "edit"] as const;
export function AnnotationTipsContent({ step }: { step: number }) {
  const { t } = useTranslation();
  return (
    <div className={styles.content} aria-live="polite" aria-atomic="true">
      <ol className={styles.dots} aria-label={t("labAnnotation.tips.progress")}>
        {STEPS.map((name, index) => (
          <li key={name} aria-current={step === index ? "step" : undefined}>
            <span className={styles.visuallyHidden}>{t(`labAnnotation.tips.${name}`)}</span>
          </li>
        ))}
      </ol>
      <h3>{t(`labAnnotation.tips.${STEPS[step] ?? "recognize"}`)}</h3>
      {step === 0 ? (
        <AnnotationEggGuide />
      ) : (
        <ul className={styles.instructions}>
          {(step === 1 ? TOOL_TIPS : METHOD_TIPS).map((key) => (
            <li key={key}>{t(`labAnnotation.tips.${key}`)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
