import { useTranslation } from "react-i18next";
import { StatusPill } from "../../ui/StatusPill";

/** A voided record keeps its row: the badge says so (icon and text) and the reason stays visible. */
export function VoidedMark({ reason }: { reason: string }) {
  const { t } = useTranslation();
  return (
    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-2">
      <StatusPill tone="critical">{t("pointPage.voided")}</StatusPill>
      {reason !== "" && <span>{t("pointPage.voidedReason", { reason })}</span>}
    </span>
  );
}
