import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AnnotationEggIllustration } from "./AnnotationEggIllustration";
import styles from "./annotation-help.module.css";

export function AnnotationEggGuide() {
  const { t } = useTranslation();
  return (
    <>
      <AnnotationEggIllustration />
      <div className={styles.columns}>
        <section>
          <h4>
            <Check aria-hidden="true" />
            {t("labAnnotation.tips.mark")}
          </h4>
          <ul className={styles.instructions}>
            <li>{t("labAnnotation.tips.eggs")}</li>
            <li>{t("labAnnotation.tips.clusters")}</li>
          </ul>
        </section>
        <section>
          <h4>
            <X aria-hidden="true" />
            {t("labAnnotation.tips.doNotMark")}
          </h4>
          <ul className={styles.instructions}>
            <li>{t("labAnnotation.tips.exclude")}</li>
            <li>{t("labAnnotation.tips.shells")}</li>
          </ul>
        </section>
      </div>
    </>
  );
}
