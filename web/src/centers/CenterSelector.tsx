import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip } from "../ui/Tooltip";
import { useCenterSelector } from "./use-center-selector";

const ALL = "__all__";

/**
 * Header center filter: a compact picker with the center NAMES only. It narrows what the screens
 * show (never an authorization grant, never another company) and hides itself when the user
 * works in a single center. Selection wiring is unchanged (`useCenterSelector`).
 */
export function CenterSelector() {
  const { t } = useTranslation();
  const selector = useCenterSelector();
  if (!selector.canRead || selector.query.isError) return null;
  if (selector.centers.length <= 1) return null;
  const value = selector.selected === "" ? (selector.isAll ? ALL : "") : selector.selected;
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        selector.select(next === ALL ? "" : next);
      }}
    >
      <Tooltip content={t("orgAdmin.center.hint")}>
        <SelectTrigger
          id="active-center"
          aria-label={t("orgAdmin.center.filter")}
          className="h-9 max-w-64 min-w-0 gap-2 rounded-full border-line bg-surface px-3 text-[13px] font-medium text-ink shadow-xs data-[size=default]:h-9"
        >
          <MapPin aria-hidden="true" strokeWidth={1.75} className="size-4 text-action" />
          <span className="text-ink-2">{t("orgAdmin.center.filter")}:</span>
          <SelectValue placeholder={t("orgAdmin.center.choose")} />
        </SelectTrigger>
      </Tooltip>
      <SelectContent
        position="popper"
        align="start"
        className="max-h-80 rounded-xl border border-line"
      >
        {selector.isAll && (
          <SelectItem value={ALL} className="min-h-9 rounded-lg text-[13px]">
            {t("orgAdmin.center.all")}
          </SelectItem>
        )}
        {selector.centers.map((center) => (
          <SelectItem key={center.id} value={center.id} className="min-h-9 rounded-lg text-[13px]">
            {center.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
