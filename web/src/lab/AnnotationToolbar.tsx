import type { RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { AnnotationToolPicker } from "./AnnotationToolPicker";
import { AnnotationToolbarExtras } from "./AnnotationToolbarExtras";
import type { AnnotationCanvasHandle, AnnotationTool } from "./EggAnnotationCanvas";
import styles from "./annotation.module.css";

export interface AnnotationToolbarProps {
  canvas: RefObject<AnnotationCanvasHandle | null>;
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  count: number;
  zoom: number;
  showGrid: boolean;
  onGrid: () => void;
  onSettings: () => void;
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
  return (
    <div className={styles.toolbar} role="group" aria-label={t("labAnnotation.editor.title")}>
      <Link to="/lab/egg-counts" search={{}}>
        {t("labAnnotation.editor.back")}
      </Link>
      <AnnotationToolPicker {...props} />
      <output aria-live="polite" aria-atomic="true">
        {t("labAnnotation.editor.counter", { count: props.count })}
      </output>
      <AnnotationToolbarExtras {...props} />
      <Button aria-disabled={props.isLocked} onClick={props.onFinish}>
        {t("labAnnotation.editor.finish")}
      </Button>
    </div>
  );
}
