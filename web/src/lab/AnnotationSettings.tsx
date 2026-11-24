import { useTranslation } from "react-i18next";
import type { AnnotationMark } from "./annotation-state";
import { AnnotationBoxSettings } from "./AnnotationBoxSettings";
import { AnnotationMarkerSettings } from "./AnnotationMarkerSettings";
import { AnnotationStats } from "./AnnotationStats";
import styles from "./annotation.module.css";

export type AnnotationColor = "action" | "success" | "critical";
export const ANNOTATION_COLORS = {
  action: "var(--color-action)",
  success: "var(--color-status-success-fg)",
  critical: "var(--color-status-critical-fg)",
} as const;
export interface AnnotationSettingsProps {
  defaultBox: { width: number; height: number };
  setDefaultBox: (size: { width: number; height: number }) => void;
  color: AnnotationColor;
  setColor: (color: AnnotationColor) => void;
  showGrid: boolean;
  onGrid: () => void;
  marks: AnnotationMark[];
  width: number;
  height: number;
  zoom: number;
}

export function AnnotationSettings(props: AnnotationSettingsProps) {
  const { t } = useTranslation();
  return (
    <aside className={styles.settings} aria-label={t("labAnnotation.editor.settings")}>
      <h2>{t("labAnnotation.editor.settings")}</h2>
      <AnnotationBoxSettings {...props} />
      <AnnotationMarkerSettings {...props} />
      <AnnotationStats {...props} />
    </aside>
  );
}
