import { useTranslation } from "react-i18next";
import { Combobox } from "../../ui/Combobox";
import type { WriteOffForm } from "./use-write-off-form";

/** The other way in: pick the lot by its name (supply and code) when there is no label to scan. */
export function WriteOffLotPicker({ form }: { form: WriteOffForm }) {
  const { t } = useTranslation();
  const options = form.lots.map((lot) => ({
    value: lot.code,
    label: `${lot.supply_version.label} · ${lot.code}`,
  }));
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor="write-off-lot" className="text-xs font-bold text-ink">
        {t("allocation.writeOff.fieldLot")}
      </label>
      <Combobox
        id="write-off-lot"
        value={form.code}
        options={options}
        placeholder={t("inventory.option.choose")}
        emptyMessage={t("allocation.writeOff.noLots")}
        onValueChange={(code) => void form.chooseCode(code)}
      />
    </div>
  );
}
