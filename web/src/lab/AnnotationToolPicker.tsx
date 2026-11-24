import { useTranslation } from "react-i18next";
import { MousePointer2, RectangleHorizontal, CircleDot, Hand } from "lucide-react";
import { AnnotationIconButton } from "./AnnotationIconButton";
import type { AnnotationToolbarProps } from "./AnnotationToolbar";
import styles from "./annotation.module.css";

const TOOLS = [
  { tool: "select", Icon: MousePointer2 },
  { tool: "box", Icon: RectangleHorizontal },
  { tool: "point", Icon: CircleDot },
  { tool: "pan", Icon: Hand },
] as const;
type Props = Pick<AnnotationToolbarProps, "tool" | "onToolChange" | "isLocked">;

export function AnnotationToolPicker(props: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.toolPicker} role="group" aria-label={t("labAnnotation.editor.tools")}>
      {TOOLS.map(({ tool, Icon }) => (
        <AnnotationIconButton
          key={tool}
          label={t(`labAnnotation.editor.${tool}`)}
          aria-pressed={props.tool === tool}
          aria-disabled={props.isLocked}
          onClick={() => {
            props.onToolChange(tool);
          }}
        >
          <Icon aria-hidden="true" />
        </AnnotationIconButton>
      ))}
    </div>
  );
}
