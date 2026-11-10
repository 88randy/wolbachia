import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "../../forms/Select";
import { TextField } from "../../forms/TextField";
import { NO_NAME } from "../../lookups/use-reference-names";
import type { WriteOffForm } from "./use-write-off-form";

function locationOptions(form: WriteOffForm) {
  const known = form.locations.map((location) => ({
    value: location.id,
    label: `${location.code} · ${location.name}`,
  }));
  const isKnown = known.some((item) => item.value === form.locationId);
  return form.locationId && !isKnown
    ? [...known, { value: form.locationId, label: NO_NAME }]
    : known;
}

/** Quantity (exact decimal text, in the supply unit) and the location the lot leaves. */
export function WriteOffLotFields({ form }: { form: WriteOffForm }) {
  const { t } = useTranslation();
  const id = useId();
  if (form.target?.kind !== "lot") return null;
  return (
    <>
      <TextField
        id={`${id}-quantity`}
        label={t("allocation.writeOff.fieldQuantity")}
        inputMode="decimal"
        required
        value={form.quantity}
        hint={form.target.lot.supply_version.unit}
        onChange={(event) => {
          form.setQuantity(event.target.value);
        }}
      />
      <Select
        id={`${id}-location`}
        label={t("allocation.writeOff.fieldLocation")}
        required
        value={form.locationId}
        options={[{ value: "", label: t("voiding.dialog.placeholder") }, ...locationOptions(form)]}
        onChange={(event) => {
          form.setLocationId(event.target.value);
        }}
      />
    </>
  );
}
