import { CalendarCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePortalFormat } from "./use-portal-format";

/** The date the figures were cut: always visible, so nobody reads old numbers as live. */
export function PortalCutoff({ iso }: { iso: string | null }) {
  const { t } = useTranslation();
  const format = usePortalFormat();
  return (
    <p className="m-0 inline-flex w-max items-center gap-2 rounded-full bg-tint px-3 py-1 text-[13px] font-semibold text-action-strong">
      <CalendarCheck aria-hidden="true" className="size-4" />
      {iso === null ? t("portal.noCutoff") : t("portal.cutoff", { date: format.date(iso) })}
    </p>
  );
}
