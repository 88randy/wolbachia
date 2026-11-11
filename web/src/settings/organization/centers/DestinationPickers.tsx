import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Combobox } from "../../../ui/Combobox";
import type { ComboboxOption } from "../../../ui/Combobox";
import { otherCentersOptions, warehousesOptions } from "./centers-api";
import { useCentersScope } from "./use-centers-scope";

interface PickerProps {
  /** The center being closed: it is never a destination. */
  centerId: string;
  value: string;
  onChange: (id: string) => void;
}

function optionOf(id: string, code: string, name: string): ComboboxOption {
  return { value: id, label: name || code, detail: code };
}

function Labeled({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-[16rem] flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-ink-2">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Another active center, picked once for every step that moves things between centers. */
export function CenterPicker({ centerId, value, onChange }: PickerProps) {
  const { t } = useTranslation();
  const query = useQuery(otherCentersOptions(useCentersScope(), centerId));
  const options = (query.data ?? []).map((row) => optionOf(row.id, row.code, row.name));
  return (
    <Labeled id="close-destination-center" label={t("centersAdmin.close.destinationCenter")}>
      <Combobox
        id="close-destination-center"
        value={value}
        options={options}
        placeholder={t("centersAdmin.close.pickCenter")}
        isLoading={query.isPending}
        onValueChange={onChange}
      />
    </Labeled>
  );
}

/** A warehouse of another center (server search inside the dropdown). */
export function WarehousePicker({ centerId, value, onChange }: PickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const query = useQuery(warehousesOptions(useCentersScope(), centerId, search));
  const options = (query.data ?? []).map((row) => optionOf(row.id, row.code, row.name));
  return (
    <Labeled id="close-destination-warehouse" label={t("centersAdmin.close.destinationWarehouse")}>
      <Combobox
        id="close-destination-warehouse"
        value={value}
        options={options}
        placeholder={t("centersAdmin.close.pickWarehouse")}
        isLoading={query.isFetching}
        onSearch={setSearch}
        onValueChange={onChange}
      />
    </Labeled>
  );
}
