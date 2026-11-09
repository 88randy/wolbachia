import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { supplyDifference } from "./domain.ts";
import type { Schemas } from "@wolbachia/api-client";
export function SupplyEquation({ line }: { readonly line: Schemas["SupplyFrameLine"] }) {
  const t = useT();
  const quantities = [
    line.credited ?? t("mobile.shiftClose.unknown"),
    line.used,
    line.returned,
    line.shrinkage,
  ].join(" ? ");
  return (
    <Card>
      <AppText variant="caption">{line.assignment_line_id}</AppText>
      <AppText>{t("mobile.shiftClose.planned")}</AppText>
      <AppText variant="bodyStrong">{line.planned}</AppText>
      <AppText>{t("mobile.shiftClose.equation")}</AppText>
      <AppText variant="bodyStrong">{quantities}</AppText>
      <AppText>{t("mobile.shiftClose.difference")}</AppText>
      <AppText variant="bodyStrong">
        {supplyDifference(line) ?? t("mobile.shiftClose.unknown")}
      </AppText>
    </Card>
  );
}
