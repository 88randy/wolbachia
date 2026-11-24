import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { AnnotationToolbarProps } from "./AnnotationToolbar";
import { useAnnotationZoom } from "./use-annotation-format";

type Props = Pick<AnnotationToolbarProps, "canvas" | "zoom" | "showGrid" | "onGrid">;

function useViewActions(props: Props) {
  const { t } = useTranslation();
  return [
    {
      label: t("labAnnotation.editor.zoomIn"),
      run: () => {
        props.canvas.current?.zoomIn();
      },
    },
    {
      label: t("labAnnotation.editor.fit"),
      run: () => {
        props.canvas.current?.fit();
      },
    },
    {
      label: t("labAnnotation.editor.actualSize"),
      run: () => {
        props.canvas.current?.actualSize();
      },
    },
  ];
}

export function AnnotationViewTools(props: Props) {
  const { t } = useTranslation();
  const actions = useViewActions(props);
  const zoom = useAnnotationZoom(props.zoom);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          props.canvas.current?.zoomOut();
        }}
      >
        {t("labAnnotation.editor.zoomOut")}
      </Button>
      <output>{t("labAnnotation.editor.zoom", { percent: zoom })}</output>
      {actions.map((action) => (
        <Button key={action.label} variant="ghost" size="sm" onClick={action.run}>
          {action.label}
        </Button>
      ))}
      <Button variant="ghost" size="sm" aria-pressed={props.showGrid} onClick={props.onGrid}>
        {t("labAnnotation.editor.grid")}
      </Button>
    </>
  );
}
