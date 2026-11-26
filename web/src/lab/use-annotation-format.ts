import { useTranslation } from "react-i18next";

export function useAnnotationCounter(count: number): string {
  const { t, i18n } = useTranslation();
  const isSingular = new Intl.PluralRules(i18n.language).select(count) === "one";
  return t(isSingular ? "labAnnotation.editor.counterOne" : "labAnnotation.editor.counterOther", {
    count,
  });
}

export function useAnnotationZoom(zoom: number): string {
  const { i18n } = useTranslation();
  return new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(zoom);
}
