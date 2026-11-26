import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import type { AnnotationSettingsProps } from "./AnnotationSettings";
import { useAnnotationZoom } from "./use-annotation-format";
import styles from "./annotation-settings.module.css";

type StatsProps = Pick<AnnotationSettingsProps, "marks" | "width" | "height" | "zoom">;
function useStats(props: StatsProps) {
  const { t, i18n } = useTranslation();
  const zoom = useAnnotationZoom(props.zoom);
  const boxes = props.marks.filter((mark) => mark.kind === "box").length;
  const points = props.marks.length - boxes;
  const mode = boxes && points ? "mixed" : points ? "points" : "boxes";
  const density = props.marks.length / ((props.width * props.height) / 1_000_000);
  const number = new Intl.NumberFormat(i18n.language);
  const dimensions = new Intl.NumberFormat(i18n.language, { useGrouping: false });
  const decimal = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 });
  return [
    [t("labAnnotation.editor.mode"), t(`labAnnotation.editor.${mode}`)],
    [t("labAnnotation.editor.boxes"), number.format(boxes)],
    [t("labAnnotation.editor.points"), number.format(points)],
    [
      t("labAnnotation.editor.density"),
      `${decimal.format(density)} ${t("labAnnotation.editor.densityUnit")}`,
    ],
    [
      t("labAnnotation.editor.resolution"),
      `${dimensions.format(props.width)}×${dimensions.format(props.height)}`,
    ],
    [t("labAnnotation.editor.zoomLabel"), zoom],
  ];
}
export function AnnotationStats(props: StatsProps) {
  const { t, i18n } = useTranslation();
  const rows = useStats(props);
  const isSingular = new Intl.PluralRules(i18n.language).select(props.marks.length) === "one";
  return (
    <section className={styles.summary} aria-label={t("labAnnotation.editor.stats")}>
      <div className={styles.total}>
        <strong>{new Intl.NumberFormat(i18n.language).format(props.marks.length)}</strong>
        <span>
          {t(isSingular ? "labAnnotation.editor.markedOne" : "labAnnotation.editor.markedOther")}
        </span>
      </div>
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
