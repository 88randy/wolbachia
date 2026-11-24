import { useTranslation } from "react-i18next";
import { Undo2, Redo2, Settings2 } from "lucide-react";
import { AnnotationIconButton } from "./AnnotationIconButton";
import type { AnnotationToolbarProps } from "./AnnotationToolbar";

type Props = Pick<
  AnnotationToolbarProps,
  "canUndo" | "canRedo" | "isLocked" | "onUndo" | "onRedo" | "onSettings" | "showSettings"
>;

export function AnnotationEditActions(props: Props) {
  const { t } = useTranslation();
  return (
    <>
      <AnnotationIconButton
        label={t("labAnnotation.editor.undo")}
        shortcut={t("labAnnotation.shortcuts.undoKey")}
        aria-disabled={!props.canUndo || props.isLocked}
        onClick={props.onUndo}
      >
        <Undo2 aria-hidden="true" />
      </AnnotationIconButton>
      <AnnotationIconButton
        label={t("labAnnotation.editor.redo")}
        shortcut={t("labAnnotation.shortcuts.redoKey")}
        aria-disabled={!props.canRedo || props.isLocked}
        onClick={props.onRedo}
      >
        <Redo2 aria-hidden="true" />
      </AnnotationIconButton>
      <AnnotationIconButton
        label={t("labAnnotation.editor.settings")}
        aria-expanded={props.showSettings}
        onClick={props.onSettings}
      >
        <Settings2 aria-hidden="true" />
      </AnnotationIconButton>
    </>
  );
}
