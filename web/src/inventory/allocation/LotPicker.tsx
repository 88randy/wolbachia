import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useFormatCalendarDate } from "../../format/use-formatters";
import { Combobox } from "../../ui/Combobox";
import type { AssignmentDraft } from "./use-assignment-draft";

/** The lot that expires first comes first (FEFO), so the oldest stock leaves before the newest. */
function byExpiry(a: Schemas["Lot"], b: Schemas["Lot"]) {
  if (a.expiry_date === b.expiry_date) return a.code.localeCompare(b.code);
  if (!a.expiry_date) return 1;
  if (!b.expiry_date) return -1;
  return a.expiry_date.localeCompare(b.expiry_date);
}

/** Add a lot by its name: supply and code, with its expiry as the muted detail. */
export function LotPicker({
  lots,
  draft,
}: {
  lots: readonly Schemas["Lot"][];
  draft: AssignmentDraft;
}) {
  const { t } = useTranslation();
  const formatDay = useFormatCalendarDate();
  const added = new Set(draft.lines.map((line) => line.lotId));
  const options = [...lots]
    .filter((lot) => lot.status === "available" && !added.has(lot.id))
    .sort(byExpiry)
    .map((lot, index) => ({
      value: lot.code,
      label: `${lot.supply_version.label} · ${lot.code}`,
      detail: [
        lot.expiry_date
          ? t("allocation.assignment.expires", { date: formatDay(lot.expiry_date) })
          : "",
        index === 0 && lot.expiry_date ? t("allocation.assignment.firstOut") : "",
      ]
        .filter(Boolean)
        .join(" · "),
    }));
  return (
    <div className="flex max-w-md min-w-0 flex-col gap-1.5">
      <label htmlFor="allocation-lot" className="text-xs font-bold text-ink">
        {t("allocation.assignment.lotPicker")}
      </label>
      <Combobox
        id="allocation-lot"
        value=""
        options={options}
        placeholder={t("inventory.option.choose")}
        emptyMessage={t("allocation.assignment.noLots")}
        onValueChange={(code) => void draft.addLot(code)}
      />
    </div>
  );
}
