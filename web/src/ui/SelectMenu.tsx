import type { FocusEventHandler } from "react";
import { cn } from "@/lib/utils";
import {
  Select as Root,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDialogContainer } from "./use-dialog-container";

/** Radix Select forbids an empty item value; "" (All / none) travels as this sentinel. */
const EMPTY = "__empty__";

const INVALID_CLASS = "border-critical-fg bg-critical-bg";
const TRIGGER_CLASS =
  "h-auto min-h-[var(--web-control-lg)] w-full min-w-0 rounded-lg border-line-strong bg-surface px-3 text-[13px] text-ink shadow-xs hover:border-ink-3 data-[size=default]:h-auto";

export interface SelectMenuOption {
  value: string;
  label: string;
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

/** The one dropdown of the app (shadcn Select): keyboard, typeahead and a styled list. */
export function SelectMenu(props: SelectMenuProps) {
  const { id, value, options, onValueChange, placeholder, invalid, describedBy } = props;
  const hasEmptyOption = options.some((option) => option.value === "");
  const current = value === "" ? (hasEmptyOption ? EMPTY : undefined) : value;
  const [container, triggerRef] = useDialogContainer();
  return (
    <Root
      value={current ?? ""}
      disabled={props.disabled}
      required={props.required}
      name={props.name}
      onValueChange={(next) => {
        onValueChange(next === EMPTY ? "" : next);
      }}
    >
      <SelectTrigger
        ref={triggerRef}
        id={id}
        aria-label={props.ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onBlur={props.onBlur}
        className={cn(TRIGGER_CLASS, invalid && INVALID_CLASS, props.className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectMenuItems options={options} container={container} />
    </Root>
  );
}

function SelectMenuItems({
  options,
  container,
}: {
  options: readonly SelectMenuOption[];
  container: HTMLElement | null;
}) {
  return (
    <SelectContent
      position="popper"
      container={container}
      className="max-h-80 rounded-xl border border-line"
    >
      {options.map((option) => (
        <SelectItem
          key={option.value || EMPTY}
          value={option.value === "" ? EMPTY : option.value}
          className="min-h-9 rounded-lg text-[13px]"
        >
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  );
}
