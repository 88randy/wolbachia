import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { Combobox } from "../../ui/Combobox";
import type { WriteOffForm } from "./use-write-off-form";

/** How much leaves (in the supply unit) and the warehouse it leaves from. */
export function WriteOffLotFields({ form }: { form: WriteOffForm }) {
  const { t } = useTranslation();
  const id = useId();
  if (form.target?.kind !== "lot") return null;
  const unit = form.target.lot.supply_version.unit;
  const options = form.locations.map((location) => ({
    value: location.id,
    label: location.name,
    detail: location.code,
  }));
  return (
    <>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={`${id}-location`} className="text-xs font-bold text-ink">
          {t("allocation.writeOff.fieldLocation")}
        </label>
        <Combobox
          id={`${id}-location`}
          value={form.locationId}
          options={options}
          placeholder={t("inventory.option.choose")}
          emptyMessage={t("inventory.option.noWarehouses")}
          onValueChange={form.setLocationId}
        />
      </div>
      <div className="max-w-60">
        <TextField
          id={`${id}-quantity`}
          label={t("allocation.writeOff.fieldQuantity")}
          inputMode="decimal"
          required
          value={form.quantity}
          trailing={
            <span className="pr-3 text-[13px] text-ink-2">
              {unit === "piece" ? t("transfers.new.unit.piece") : unit}
            </span>
          }
          onChange={(event) => {
            form.setQuantity(event.target.value);
          }}
        />
      </div>
    </>
  );
}
