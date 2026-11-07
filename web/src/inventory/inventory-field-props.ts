import type { InventoryFieldsProps } from "./inventory-form-types";
export function inventoryFieldProps(props: InventoryFieldsProps, name: string) {
  return {
    name,
    value: props.values[name] ?? "",
    disabled: props.disabled,
    onChange: (value: string) => {
      props.setValue(name, value);
    },
  };
}
