import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { supplyDifference } from "./domain.ts";
import type { Schemas } from "@wolbachia/api-client";
export function SupplyEquation({ line }: { readonly line: Schemas["SupplyFrameLine"] }) {
  const t = useT();
  return <Card>
    <AppText variant="mono">{line.assignment_line_id}</AppText>
    <AppText>{t("mobile.shiftClose.planned")}</AppText><AppText variant="mono">{line.planned}</AppText>
    <AppText>{t("mobile.shiftClose.equation")}</AppText>
    <AppText variant="mono">{[line.credited ?? t("mobile.shiftClose.unknown"), line.used, line.returned, line.shrinkage].join(" ? ")}</AppText>
    <AppText>{t("mobile.shiftClose.difference")}</AppText><AppText variant="mono">{supplyDifference(line) ?? t("mobile.shiftClose.unknown")}</AppText>
  </Card>;
}
