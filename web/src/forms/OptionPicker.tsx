import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface PickerOption {
  value: string;
  /** What the user reads and searches: a name, never an id. */
  label: string;
  /** Second line, e.g. a role or a code. */
  hint?: string;
}

export interface OptionPickerProps {
  id: string;
  label: string;
  value: string;
  options: readonly PickerOption[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
  error?: string;
  /** Shown while the options load. */
  isLoading?: boolean;
}

/**
 * Searchable picker for people, courses, zones and similar records: type a few letters of the
 * name, pick with the keyboard or the pointer. It never asks for an id.
 */
export function OptionPicker(props: OptionPickerProps) {
  const { id, label, value, options, onChange, placeholder, disabled, invalid, error } = props;
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            aria-invalid={invalid || undefined}
            aria-describedby={error === undefined ? undefined : `${id}-error`}
            disabled={disabled}
            className={cn(
              "flex min-h-[var(--web-control-lg)] w-full items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-3 text-left text-[13px] shadow-xs hover:border-ink-3 disabled:opacity-60",
              invalid && "border-critical-fg bg-critical-bg",
              selected === undefined ? "text-ink-3" : "text-ink",
            )}
          >
            <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
            <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[90] w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder={t("ui.picker.search")} />
            <CommandList id={`${id}-list`}>
              <CommandEmpty>
                {props.isLoading ? t("ui.picker.loading") : t("ui.picker.empty")}
              </CommandEmpty>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.hint ?? ""}`}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    aria-hidden="true"
                    className={cn("size-4", option.value === value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.hint !== undefined && (
                      <span className="truncate text-xs text-ink-3">{option.hint}</span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error !== undefined && (
        <p id={`${id}-error`} className="m-0 text-xs text-critical-fg">
          {error}
        </p>
      )}
    </div>
  );
}
