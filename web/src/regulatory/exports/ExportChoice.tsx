/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportChoiceProps<Value extends string> {
  legend: string;
  value: Value;
  options: readonly { value: Value; label: string }[];
  onChange: (value: Value) => void;
}

/** A visible choice among few options: the selected one is filled and carries a check. */
export function ExportChoice<Value extends string>(props: ExportChoiceProps<Value>) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-xs font-semibold text-ink-2">{props.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {props.options.map((option) => {
          const isSelected = option.value === props.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                props.onChange(option.value);
              }}
              className={cn(
                "inline-flex min-h-[var(--web-control-lg)] items-center gap-2 rounded-lg border px-4 text-[13px] font-semibold",
                isSelected
                  ? "border-action bg-action text-on-action"
                  : "border-line-strong bg-surface text-ink hover:border-ink-3",
              )}
            >
              {isSelected && <Check aria-hidden="true" className="size-4" />}
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
