import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Combobox } from "../../ui/Combobox";
import { courierState } from "./use-assignment-route";

/** The courier is chosen by name; the selection rides in the history state, never as an id in the URL. */
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
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor="allocation-courier" className="text-xs leading-5 font-bold text-ink">
        {t("allocation.assignment.courier")}
      </label>
      <Combobox
        id="allocation-courier"
        value={selected}
        options={options}
        placeholder={t("allocation.assignment.courierPlaceholder")}
        emptyMessage={t("allocation.assignment.noCouriers")}
        onValueChange={(courier) => {
          void navigate({
            to: "/inventory/assignments/new",
            search: { date },
            state: courierState(courier),
          });
        }}
      />
    </div>
  );
}
