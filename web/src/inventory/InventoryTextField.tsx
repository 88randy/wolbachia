import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../forms/TextField";
import { fieldKeys } from "./inventory-fields";
export interface InventoryTextProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  type?: "text" | "number" | "date";
  maxLength?: number;
}
export function InventoryTextField(props: InventoryTextProps) {
  const { t } = useTranslation();
  const [isTouched, setTouched] = useState(false);
  const error =
    isTouched && props.required && !props.value.trim() ? t("inventory.state.required") : undefined;
  return (
    <TextField
      id={`inventory-${props.name}`}
      label={t(fieldKeys[props.name] ?? "inventory.field.name")}
      value={props.value}
      required={props.required}
      disabled={props.disabled}
      type={props.type ?? "text"}
      maxLength={props.maxLength ?? 4000}
      error={error}
      onBlur={() => {
        setTouched(true);
      }}
      onChange={(event) => {
        props.onChange(event.target.value);
      }}
    />
  );
}
