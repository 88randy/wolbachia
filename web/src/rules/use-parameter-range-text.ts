import { useTranslation } from "react-i18next";
import { useFormatNumber } from "../format/use-formatters";
import type { RuleParameter } from "./rules-query";
/** Bounds may be absent independently; a missing bound is never reported as zero. */
export function useParameterRangeText(parameter: RuleParameter): string {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const { min_value: min, max_value: max } = parameter;
  if (min !== null && max !== null)
    return t("rules.range.between", { min: formatNumber(min), max: formatNumber(max) });
  if (min !== null) return t("rules.range.atLeast", { min: formatNumber(min) });
  if (max !== null) return t("rules.range.atMost", { max: formatNumber(max) });
  return t("rules.range.none");
}
