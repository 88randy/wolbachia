import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { enUS, es } from "react-day-picker/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFormatCalendarDate } from "../format/use-formatters";
import { useLanguage } from "../i18n/use-language";
import { CONTROL_TRIGGER, FIELD_LABEL_CLASS, FIELD_STACK_CLASS } from "./control-classes";
import { useDialogContainer } from "./use-dialog-container";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDay(value: string): Date | undefined {
  const match = ISO_DAY.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/** One calendar day picked from a calendar; the person never sees or types an ISO date. */
export function DateField(props: {
  id: string;
  label: string;
  /** `YYYY-MM-DD`, or empty. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Kept for old callers: every field is the same 40 px now. */
  size?: "lg" | "xl";
  /** Last day that can be picked (`YYYY-MM-DD`). */
  max?: string;
  /** Already translated error text: red text below, `aria-invalid` on the button. */
  error?: string | undefined;
}) {
  const { language } = useLanguage();
  const format = useFormatCalendarDate();
  const [isOpen, setIsOpen] = useState(false);
  const [container, triggerRef] = useDialogContainer();
  const selected = parseDay(props.value);
  const last = props.max === undefined ? undefined : parseDay(props.max);
  return (
    <div className={FIELD_STACK_CLASS}>
      <label htmlFor={props.id} className={FIELD_LABEL_CLASS}>
        {props.label}
      </label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
            id={props.id}
            type="button"
            disabled={props.disabled}
            aria-invalid={props.error === undefined ? undefined : true}
            aria-describedby={props.error === undefined ? undefined : `${props.id}-error`}
            className={cn(CONTROL_TRIGGER, props.error !== undefined && "border-critical-fg")}
          >
            <CalendarDays aria-hidden="true" className="size-4 flex-none text-ink-2" />
            <span className="min-w-0 flex-1 truncate">{selected ? format(props.value) : "—"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent container={container} align="start" className="w-auto p-2">
          <Calendar
            mode="single"
            locale={language === "en" ? enUS : es}
            selected={selected}
            defaultMonth={selected}
            disabled={last ? { after: last } : undefined}
            onSelect={(date) => {
              if (!date) return;
              props.onChange(toIsoDay(date));
              setIsOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {props.error !== undefined && (
        <p id={`${props.id}-error`} className="m-0 text-xs font-semibold text-critical-fg">
          {props.error}
        </p>
      )}
    </div>
  );
}
