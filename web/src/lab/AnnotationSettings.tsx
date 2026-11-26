import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import type { AnnotationTool } from "./annotation-canvas-types";
import type { AnnotationMark } from "./annotation-state";
import type { AnnotationColor } from "./annotation-colors";
import { AnnotationConfiguration } from "./AnnotationConfiguration";
import { AnnotationStats } from "./AnnotationStats";
import { AnnotationShortcutTable } from "./AnnotationShortcutTable";
import { AnnotationSettingsGuide } from "./AnnotationSettingsGuide";
import { SideSheet } from "../ui/SideSheet";
import styles from "./annotation-settings.module.css";

export { ANNOTATION_COLORS, type AnnotationColor } from "./annotation-colors";
export interface AnnotationSettingsProps {
  userId: string;
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  defaultBox: { width: number; height: number };
  setDefaultBox: (size: { width: number; height: number }) => void;
  color: AnnotationColor;
  setColor: (color: AnnotationColor) => void;
  showGrid: boolean;
  onGrid: () => void;
  gridSize: number;
  setGridSize: (size: number) => void;
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
      title={t("labAnnotation.editor.panel")}
      titleIcon={<Settings aria-hidden="true" />}
      className={styles.panel}
      description={t("labAnnotation.editor.settingsDescription")}
      onCloseAutoFocus={props.onCloseAutoFocus}
    >
      <div className={styles.settings}>
        <AnnotationStats {...props} />
        <AnnotationConfiguration {...props} />
        <section aria-label={t("labAnnotation.editor.keyboardShortcuts")}>
          <h3>{t("labAnnotation.editor.keyboardShortcuts")}</h3>
          <AnnotationShortcutTable isCompact />
        </section>
      </div>
      <AnnotationSettingsGuide userId={props.userId} />
    </SideSheet>
  );
}
