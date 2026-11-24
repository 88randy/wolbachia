import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Button } from "../ui/Button";
import { AnnotationBackLink } from "./AnnotationBackLink";
import { AnnotationToolPicker } from "./AnnotationToolPicker";
import { AnnotationToolbarExtras } from "./AnnotationToolbarExtras";
import type { AnnotationCanvasHandle, AnnotationTool } from "./EggAnnotationCanvas";
import styles from "./annotation.module.css";
import { useAnnotationCounter } from "./use-annotation-format";

export interface AnnotationToolbarProps {
  canvas: RefObject<AnnotationCanvasHandle | null>;
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  count: number;
  zoom: number;
  showGrid: boolean;
  onGrid: () => void;
  onSettings: () => void;
  showSettings?: boolean;
  onHelp?: () => void;
  onTips?: () => void;
  onBack?: () => void;
  onFinish: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isLocked: boolean;
  onDownloadMarks: () => void;
  onDownloadImage: () => void;
}
export { AnnotationViewTools } from "./AnnotationViewTools";

export function AnnotationToolbar(props: AnnotationToolbarProps) {
  const { t } = useTranslation();
  const counter = useAnnotationCounter(props.count);
  return (
    <div className={styles.toolbar} role="group" aria-label={t("labAnnotation.editor.title")}>
      <AnnotationBackLink />
      <AnnotationToolPicker {...props} />
      <output aria-live="polite" aria-atomic="true">
        {counter}
      </output>
      <AnnotationToolbarExtras {...props} />
      <Button
        size="sm"
        className={styles.finish}
        leadingIcon={<Check aria-hidden="true" />}
        aria-disabled={props.isLocked}
        onClick={props.onFinish}
      >
        {t("labAnnotation.editor.finish")}
      </Button>
    </div>
  );
}
