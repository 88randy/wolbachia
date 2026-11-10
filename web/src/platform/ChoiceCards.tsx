/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { CircleCheck, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChoiceCard<Value extends string> {
  value: Value;
  label: string;
  hint?: string;
}

interface ChoiceCardsProps<Value extends string> {
  name: string;
  legend: string;
  value: Value;
  options: readonly ChoiceCard<Value>[];
  onChange: (value: Value) => void;
}

/** A radio group drawn as cards: the selected one is filled (color + icon + text). */
export function ChoiceCards<Value extends string>(props: ChoiceCardsProps<Value>) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1.5 p-0 text-xs font-semibold text-ink-2">{props.legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {props.options.map((option) => {
          const isSelected = option.value === props.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-action",
                isSelected
                  ? "border-action bg-tint"
                  : "border-line-strong bg-surface hover:border-ink-3",
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={props.name}
                value={option.value}
                checked={isSelected}
                onChange={() => {
                  props.onChange(option.value);
                }}
              />
              {isSelected ? (
                <CircleCheck aria-hidden="true" className="mt-0.5 size-5 flex-none text-action" />
              ) : (
                <Circle aria-hidden="true" className="mt-0.5 size-5 flex-none text-ink-3" />
              )}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{option.label}</span>
                {option.hint && <span className="text-xs text-ink-2">{option.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
