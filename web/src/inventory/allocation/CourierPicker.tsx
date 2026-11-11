import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Combobox } from "../../ui/Combobox";

/** The courier is chosen by name and lives in the address bar, so a view can be shared. */
export function CourierPicker({
  couriers,
  selected,
  date,
}: {
  couriers: readonly Schemas["OperationalPersonnel"][];
  selected: string;
  date: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const options = couriers.map((person) => ({ value: person.id, label: person.display_name }));
  return (
    <div className="flex max-w-md min-w-0 flex-col gap-1.5">
      <label htmlFor="allocation-courier" className="text-xs font-bold text-ink">
        {t("allocation.assignment.courier")}
      </label>
      <Combobox
        id="allocation-courier"
        value={selected}
        options={options}
        placeholder={t("allocation.assignment.courierPlaceholder")}
        emptyMessage={t("allocation.assignment.noCouriers")}
        onValueChange={(courier) => {
          void navigate({ to: "/inventory/assignments", search: { date, courier } });
        }}
      />
    </div>
  );
}
