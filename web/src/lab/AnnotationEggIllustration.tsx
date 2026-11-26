import { useTranslation } from "react-i18next";
import styles from "./annotation-help.module.css";

export function AnnotationEggIllustration() {
  const { t } = useTranslation();
  return (
    <svg
      className={styles.eggs}
      viewBox="0 0 300 74"
      role="img"
      aria-label={t("labAnnotation.tips.illustration")}
    >
      <ellipse cx="46" cy="38" rx="7" ry="21" transform="rotate(28 46 38)" />
      <ellipse cx="93" cy="32" rx="7" ry="21" transform="rotate(-20 93 32)" />
      <ellipse cx="157" cy="39" rx="7" ry="21" transform="rotate(16 157 39)" />
      <ellipse cx="177" cy="36" rx="7" ry="21" transform="rotate(21 177 36)" />
      <ellipse cx="241" cy="36" rx="7" ry="21" transform="rotate(-32 241 36)" />
    </svg>
  );
}
