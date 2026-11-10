import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const STEPS = [
  { number: 1, key: "scheduling.import.stepName1" },
  { number: 2, key: "scheduling.import.stepName2" },
  { number: 3, key: "scheduling.import.stepName3" },
] as const;

/** The three steps of the import by name, so you always see where you are and what is left. */
export function ImportStepper({ step }: { step: number }) {
  const { t } = useTranslation();
  return (
    <ol
      aria-label={t("scheduling.import.stepsLabel")}
      className="m-0 flex list-none items-center gap-2 p-0"
    >
      {STEPS.map(({ number, key }) => {
        const isDone = number < step;
        const isCurrent = number === step;
        return (
          <li
            key={number}
            aria-current={isCurrent ? "step" : undefined}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-7 flex-none place-items-center rounded-full text-xs font-bold",
                isDone && "bg-success-fg text-on-action",
                isCurrent && "bg-action text-on-action",
                !isDone && !isCurrent && "bg-tint text-ink-2",
              )}
            >
              {isDone ? <Check className="size-4" strokeWidth={3} /> : number}
            </span>
            <span
              className={cn(
                "min-w-0 text-[13px] font-semibold [overflow-wrap:anywhere]",
                isCurrent ? "text-ink" : "text-ink-2",
              )}
            >
              {t(key)}
            </span>
            {number < STEPS.length && (
              <span aria-hidden="true" className="h-px flex-1 bg-line-strong" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
