import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { Combobox } from "../ui/Combobox";
import { useLocationDirectory } from "./use-location-directory";

/** Pick a warehouse or storage point by name (its code is the muted detail); never an id. */
export function LocationCombobox(props: {
  id: string;
  label: string;
  value: string;
  excludeId?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const canCreate = useCan()("location.create");
  const query = useLocationDirectory();
  const rows = query.data ?? [];
  const isRepeated = (name: string) => rows.filter((row) => row.name === name).length > 1;
  const options = rows
    .filter((location) => location.id !== props.excludeId)
    .map((location) => ({
      value: location.id,
      label: isRepeated(location.name) ? `${location.name} (${location.code})` : location.name,
      detail: location.code,
    }));
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={props.id} className="text-xs font-bold text-ink">
        {props.label}
      </label>
      <Combobox
        id={props.id}
        value={props.value}
        options={options}
        placeholder={t("inventory.option.choose")}
        isLoading={query.isPending}
        emptyMessage={
          <span className="flex flex-col items-center gap-1 px-2 py-1 text-center">
            <span>{t("inventory.option.noWarehouses")}</span>
            {canCreate && (
              <Link to="/inventory/locations" className="font-semibold">
                {t("inventory.option.createLocation")}
              </Link>
            )}
          </span>
        }
        onValueChange={props.onChange}
      />
    </div>
  );
}
