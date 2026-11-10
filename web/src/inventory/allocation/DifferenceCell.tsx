import { useTranslation } from "react-i18next";
import { StatusPill } from "../../ui/StatusPill";
import { useLanguage } from "../../i18n/use-language";
import { formatInventoryQuantity } from "../format-inventory-quantity";
import { differenceSign } from "./reconciliation-equation";
import type { FrameLine, LineState } from "./reconciliation-equation";

/** Status is never color alone: the sign, an icon and the text all state it. */
export function DifferenceCell({ line, state }: { line: FrameLine; state: LineState }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  if (state === "pending" || line.difference === null)
    return <StatusPill tone="neutral">{t("allocation.reconciliation.pending")}</StatusPill>;
  const sign = differenceSign(line.difference);
  const value = formatInventoryQuantity(line.difference, language);
  if (state === "balanced")
    return <StatusPill tone="success">{t("allocation.reconciliation.balanced")}</StatusPill>;
  return (
    <StatusPill tone="critical">
      {sign === "positive" ? `+${value}` : value.replace("-", "−")}
    </StatusPill>
  );
}
