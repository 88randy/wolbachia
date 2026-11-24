import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { AnnotationToolbarProps } from "./AnnotationToolbar";

type Props = Pick<
  AnnotationToolbarProps,
  "canUndo" | "canRedo" | "isLocked" | "onUndo" | "onRedo" | "onSettings"
>;

export function AnnotationEditActions(props: Props) {
  const { t } = useTranslation();
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        aria-disabled={!props.canUndo || props.isLocked}
        onClick={props.onUndo}
      >
        {t("labAnnotation.editor.undo")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-disabled={!props.canRedo || props.isLocked}
        onClick={props.onRedo}
      >
        {t("labAnnotation.editor.redo")}
      </Button>
      <Button size="sm" variant="ghost" onClick={props.onSettings}>
        {t("labAnnotation.editor.settings")}
      </Button>
    </>
  );
}
