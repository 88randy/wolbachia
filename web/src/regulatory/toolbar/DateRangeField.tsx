import { CalendarDays } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { enUS, es } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFormatCalendarDate } from "../../format/use-formatters";
import { useLanguage } from "../../i18n/use-language";
import { fromIsoDay, toIsoDay } from "./date-range";

export interface DateRangeFieldProps {
  label: string;
  from: string | undefined;
  to: string | undefined;
  onChange: (range: { from: string | undefined; to: string | undefined }) => void;
}

/** One calendar for a range: click the first day, then the last. Never typed, never ISO on screen. */
export function DateRangeField({ label, from, to, onChange }: DateRangeFieldProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const format = useFormatCalendarDate();
  const id = useId();
  const start = fromIsoDay(from);
  const end = fromIsoDay(to);
  const summary =
    from === undefined ? t("regulatory.common.pickDates") : `${format(from)} – ${format(to ?? from)}`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-ink-2">
        {label}
      </label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            className="inline-flex min-h-[var(--web-control-lg)] w-full items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-left text-[13px] text-ink hover:border-ink-3"
          >
            <CalendarDays aria-hidden="true" className="size-4 flex-none text-ink-2" />
            <span className="min-w-0 flex-1 truncate">{summary}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="range"
            numberOfMonths={1}
            locale={language === "en" ? enUS : es}
            selected={start === undefined ? undefined : { from: start, to: end }}
            onSelect={(range) => {
              onChange({
                from: range?.from === undefined ? undefined : toIsoDay(range.from),
                to: range?.to === undefined ? undefined : toIsoDay(range.to),
              });
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
