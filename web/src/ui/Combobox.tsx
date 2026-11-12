import { Check, ChevronsUpDown, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { FocusEventHandler, ReactNode } from "react";
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
import { CONTROL_TRIGGER } from "./control-classes";
import { useDialogContainer } from "./use-dialog-container";

export interface ComboboxOption {
  value: string;
  /** The human name, shown first. */
  label: string;
  /** Secondary muted text (the human code). */
  detail?: string;
}

export interface ComboboxProps {
  id: string;
  value: string;
  options: readonly ComboboxOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** Label of the selected value when it is not in the current options (server search). */
  selectedLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Accessible name when there is no visible <label htmlFor={id}>. */
  ariaLabel?: string;
  /**
   * Server search: called (already debounced by the caller or not) with the typed text; the
   * options are then whatever the caller fetched. Without it, the typed text filters locally.
   */
  onSearch?: (search: string) => void;
  isLoading?: boolean;
  /** Shown when the list is legitimately empty (for example a message with a "Create" link). */
  emptyMessage?: ReactNode;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  className?: string;
}

/** The one picker of the app: a button that opens a list with a search box inside. */
export function Combobox(props: ComboboxProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [container, triggerRef] = useDialogContainer();
  const current = props.options.find((option) => option.value === props.value);
  const shown = current?.label ?? (props.value ? props.selectedLabel : undefined);
  const pick = (value: string) => {
    props.onValueChange(value);
    setIsOpen(false);
  };
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          id={props.id}
          type="button"
          role="combobox"
          aria-expanded={isOpen}
          aria-label={props.ariaLabel}
          aria-invalid={props.invalid || undefined}
          aria-describedby={props.describedBy}
          disabled={props.disabled}
          onBlur={props.onBlur}
          className={cn(
            CONTROL_TRIGGER,
            props.invalid && "border-critical-fg bg-critical-bg",
            props.className,
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", shown === undefined && "text-ink-3")}>
            {shown ?? props.placeholder ?? t("common.actions.search")}
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-4 flex-none text-ink-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        container={container}
        align="start"
        collisionPadding={16}
        className="w-[max(var(--radix-popover-trigger-width),16rem)] rounded-xl border border-line p-0"
      >
        <Command shouldFilter={props.onSearch === undefined}>
          {props.options.length > 6 || props.onSearch ? (
            <CommandInput
              placeholder={t("table.filters.searchPlaceholder")}
              onValueChange={props.onSearch}
            />
          ) : null}
          <CommandList className="max-h-72">
            {props.isLoading ? (
              <div className="grid place-items-center py-4 text-ink-3">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              </div>
            ) : (
              <CommandEmpty>{props.emptyMessage ?? t("table.empty.filteredTitle")}</CommandEmpty>
            )}
            {props.options.map((option) => (
              <CommandItem
                key={option.value || "__empty__"}
                value={`${option.label} ${option.detail ?? ""} ${option.value}`}
                className="min-h-9 gap-2 rounded-lg text-[13px]"
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
  );
}
