import { useTranslation } from "react-i18next";
import { Select } from "../forms/Select";
import type { MessageKey } from "@wolbachia/i18n";
import { fieldKeys } from "./inventory-fields";
interface Props {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, MessageKey])[];
  required?: boolean;
  disabled?: boolean;
}
export const YES_NO = [
  ["true", "inventory.option.yes"],
  ["false", "inventory.option.no"],
] as const;
export function InventorySelectField(props: Props) {
  const { t } = useTranslation();
  const emptyKey = props.required ? "inventory.option.choose" : "inventory.state.unconfigured";
  const options = [
    { value: "", label: t(emptyKey) },
    ...props.options.map(([value, key]) => ({ value, label: t(key) })),
  ];
  return (
    <Select
      id={`inventory-${props.name}`}
      label={t(fieldKeys[props.name] ?? "inventory.field.name")}
      value={props.value}
      required={props.required}
      disabled={props.disabled}
      options={options}
      onChange={(event) => {
        props.onChange(event.target.value);
      }}
    />
  );
}
