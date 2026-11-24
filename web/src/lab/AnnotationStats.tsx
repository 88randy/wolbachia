import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import type { AnnotationSettingsProps } from "./AnnotationSettings";
import { useAnnotationZoom } from "./use-annotation-format";

type StatsProps = Pick<AnnotationSettingsProps, "marks" | "width" | "height" | "zoom">;
function useStats(props: StatsProps) {
  const { t, i18n } = useTranslation();
  const zoom = useAnnotationZoom(props.zoom);
  const boxes = props.marks.filter((mark) => mark.kind === "box").length;
  const density = props.marks.length / ((props.width * props.height) / 1_000_000);
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  return [
    [t("lab.count.value"), number.format(props.marks.length)],
    [t("labAnnotation.editor.boxes"), number.format(boxes)],
    [t("labAnnotation.editor.points"), number.format(props.marks.length - boxes)],
    [t("labAnnotation.editor.density"), number.format(density)],
    [
      t("labAnnotation.editor.resolution"),
      `${number.format(props.width)} × ${number.format(props.height)}`,
    ],
    [t("labAnnotation.editor.zoomLabel"), zoom],
  ];
}

export function AnnotationStats(props: StatsProps) {
  const { t } = useTranslation();
  const rows = useStats(props);
  return (
    <section aria-label={t("labAnnotation.editor.stats")}>
      <h3>{t("labAnnotation.editor.stats")}</h3>
      <dl>
        {rows.map(([label, value]) => (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}
