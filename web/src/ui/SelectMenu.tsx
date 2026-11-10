import type { FocusEventHandler } from "react";
import { Combobox } from "./Combobox";

export interface SelectMenuOption {
  value: string;
  label: string;
  /** Secondary muted text (the human code). */
  detail?: string;
}

export interface SelectMenuProps {
  id: string;
  value: string;
  options: readonly SelectMenuOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  invalid?: boolean;
  describedBy?: string;
  /** Accessible name when there is no visible <label htmlFor={id}>. */
  ariaLabel?: string;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  className?: string;
}

/**
 * The one dropdown of the app: the shared `Combobox` (search inside the list once it has more
 * than a few options). Kept as a thin alias so existing screens keep their props.
 */
export function SelectMenu(props: SelectMenuProps) {
  return (
    <Combobox
      id={props.id}
      value={props.value}
      options={props.options}
      onValueChange={props.onValueChange}
      placeholder={props.placeholder ?? props.options.find((option) => option.value === "")?.label}
      disabled={props.disabled}
      invalid={props.invalid}
      describedBy={props.describedBy}
      ariaLabel={props.ariaLabel}
      onBlur={props.onBlur}
      className={props.className}
    />
  );
}
