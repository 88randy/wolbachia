import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { AnnotationToolbarProps } from "./AnnotationToolbar";

const TOOLS = ["select", "box", "point", "pan"] as const;
type Props = Pick<AnnotationToolbarProps, "tool" | "onToolChange" | "isLocked">;

export function AnnotationToolPicker(props: Props) {
  const { t } = useTranslation();
  return (
    <>
      {TOOLS.map((tool) => (
        <Button
          key={tool}
          size="sm"
          variant="ghost"
          aria-pressed={props.tool === tool}
          aria-disabled={props.isLocked}
          onClick={() => {
            props.onToolChange(tool);
          }}
        >
          {t(`labAnnotation.editor.${tool}`)}
        </Button>
      ))}
    </>
  );
}
