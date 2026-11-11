import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import { useFormatCalendarDate } from "../../format/use-formatters";
import { Combobox } from "../../ui/Combobox";
import { InlineNotice } from "../../ui/InlineNotice";
import type { AssignmentDraft, ScanState } from "./use-assignment-draft";

const SCAN_KEYS: Record<Exclude<ScanState, "idle" | "loading">, MessageKey> = {
  notFound: "allocation.assignment.scanResultNotFound",
  duplicate: "allocation.assignment.scanResultDuplicate",
  piece: "allocation.assignment.scanResultPiece",
  failed: "allocation.assignment.scanResultFailed",
};

/** The lot that expires first comes first (FEFO), so the oldest stock leaves before the newest. */
function byExpiry(a: Schemas["Lot"], b: Schemas["Lot"]) {
  if (a.expiry_date === b.expiry_date) return a.code.localeCompare(b.code);
  if (!a.expiry_date) return 1;
  if (!b.expiry_date) return -1;
  return a.expiry_date.localeCompare(b.expiry_date);
}

function matches(lot: Schemas["Lot"], search: string) {
  const text = search.trim().toLowerCase();
  if (!text) return true;
  return `${lot.code} ${lot.supply_version.label}`.toLowerCase().includes(text);
}

/**
 * ONE way to add a lot: pick it by name, or scan or type its code and press Enter (the exact code
 * comes first, so Enter adds it). Lots that expire first are listed first.
 */
export function LotAdder({
  lots,
  draft,
}: {
  lots: readonly Schemas["Lot"][];
  draft: AssignmentDraft;
}) {
  const { t } = useTranslation();
  const formatDay = useFormatCalendarDate();
  const [search, setSearch] = useState("");
  const added = new Set(draft.lines.map((line) => line.lotId));
  const exact = search.trim().toLowerCase();
  const available = [...lots]
    .filter((lot) => lot.status === "available" && !added.has(lot.id) && matches(lot, search))
    .sort(byExpiry)
    .sort(
      (a, b) => Number(b.code.toLowerCase() === exact) - Number(a.code.toLowerCase() === exact),
    );
  const options = available.map((lot, index) => ({
    value: lot.code,
    label: `${lot.supply_version.label} · ${lot.code}`,
    detail: [
      lot.expiry_date
        ? t("allocation.assignment.expires", { date: formatDay(lot.expiry_date) })
        : "",
      index === 0 && lot.expiry_date && !exact ? t("allocation.assignment.firstOut") : "",
    ]
      .filter(Boolean)
      .join(" · "),
  }));
  const scan = draft.scan;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor="allocation-lot" className="text-xs font-bold text-ink">
        {t("allocation.assignment.lotAdder")}
      </label>
      <Combobox
        id="allocation-lot"
        value=""
        options={options}
        placeholder={t("allocation.assignment.lotAdderPlaceholder")}
        emptyMessage={t("allocation.assignment.noLots")}
        onSearch={setSearch}
        onValueChange={(code) => {
          setSearch("");
          void draft.addLot(code);
        }}
      />
      <div aria-live="polite">
        {scan !== "idle" && scan !== "loading" && (
          <InlineNotice tone="warning">{t(SCAN_KEYS[scan])}</InlineNotice>
        )}
      </div>
    </div>
  );
}
