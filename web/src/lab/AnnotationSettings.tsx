import { useTranslation } from "react-i18next";
import type { AnnotationMark } from "./annotation-state";
import { AnnotationBoxSettings } from "./AnnotationBoxSettings";
import { AnnotationMarkerSettings } from "./AnnotationMarkerSettings";
import { AnnotationStats } from "./AnnotationStats";
import { SideSheet } from "../ui/SideSheet";
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
  onClose?: () => void;
  onCloseAutoFocus?: (event: Event) => void;
}

export function AnnotationSettings(props: AnnotationSettingsProps) {
  const { t } = useTranslation();
  return (
    <SideSheet
      trigger={null}
      open
      onOpenChange={(open) => {
        if (!open) props.onClose?.();
      }}
      title={t("labAnnotation.editor.settings")}
      description={t("labAnnotation.editor.settingsDescription")}
      onCloseAutoFocus={props.onCloseAutoFocus}
    >
      <div className={styles.settings}>
        <AnnotationBoxSettings {...props} />
        <AnnotationMarkerSettings {...props} />
        <AnnotationStats {...props} />
      </div>
    </SideSheet>
  );
}
