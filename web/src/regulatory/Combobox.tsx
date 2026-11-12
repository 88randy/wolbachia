/* eslint-disable max-lines-per-function -- presentational JSX of one picker. */
import { Check, ChevronsUpDown } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CONTROL_TRIGGER, FIELD_LABEL_CLASS, FIELD_STACK_CLASS } from "../ui/control-classes";

export interface ComboboxOption {
  value: string;
  label: string;
  detail?: string;
}

interface ComboboxProps {
  label: string;
  value: string;
  options: readonly ComboboxOption[];
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Offer an entry that clears the choice (an optional picker). */
  clearLabel?: string;
}

/** One picker: a button that opens a list with a search box inside. Names, never ids. */
export function Combobox(props: ComboboxProps) {
  const { t } = useTranslation();
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const current = props.options.find((option) => option.value === props.value);
  const pick = (value: string) => {
    props.onChange(value);
    setIsOpen(false);
  };
  return (
    <div className={FIELD_STACK_CLASS}>
      <label htmlFor={id} className={FIELD_LABEL_CLASS}>
        {props.label}
      </label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={`${id}-list`}
            disabled={props.disabled}
            className={CONTROL_TRIGGER}
          >
            <span className={cn("min-w-0 flex-1 truncate", current === undefined && "text-ink-3")}>
              {current?.label ?? props.placeholder}
            </span>
            <ChevronsUpDown aria-hidden="true" className="size-4 flex-none text-ink-2" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command>
            <CommandInput placeholder={t("regulatory.common.search")} />
            <CommandList id={`${id}-list`}>
              <CommandEmpty>{t("regulatory.common.noResults")}</CommandEmpty>
              {props.clearLabel !== undefined && (
                <CommandItem
                  value={props.clearLabel}
                  onSelect={() => {
                    pick("");
                  }}
                >
                  {props.clearLabel}
                </CommandItem>
              )}
              {props.options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.detail ?? ""}`}
                  onSelect={() => {
                    pick(option.value);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.detail && <span className="text-xs text-ink-3">{option.detail}</span>}
                  {option.value === props.value && <Check aria-hidden="true" className="size-4" />}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
