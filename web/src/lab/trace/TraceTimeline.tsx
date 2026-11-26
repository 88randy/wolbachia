import { Check, Circle, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { buildTimeline } from "./trace-model";
import type { TimelineStep } from "./trace-model";
import type { BagTrace } from "./trace-query";

function StepMark({ step }: { step: TimelineStep }) {
  const { t } = useTranslation();
  if (step.at === null)
    return (
      <>
        <Circle aria-hidden="true" className="size-4 text-ink-3" />
        <span className="sr-only">{t("labTrace.step.pending")}</span>
      </>
    );
  const Icon = step.voided ? Undo2 : Check;
  return (
    <>
      <Icon aria-hidden="true" className="size-4 text-action" />
      <span className="sr-only">
        {t(step.voided ? "labTrace.step.voided" : "labTrace.step.done")}
      </span>
    </>
  );
}

function StepLine({ step }: { step: TimelineStep }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const struck = step.voided ? "line-through" : "";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className={`text-sm font-semibold text-ink ${struck}`}>{step.label}</span>
      <span className={`text-xs text-ink-2 ${struck}`}>
        {step.at === null ? (
          t("labTrace.step.pending")
        ) : (
          <time dateTime={step.at}>{format(step.at)}</time>
        )}
        {step.by && ` · ${t("labTrace.step.by", { name: step.by })}`}
      </span>
      {step.note && <span className="text-xs text-ink-3">{step.note}</span>}
      {step.voided && (
        <span className="text-xs text-critical-fg">
          {t("labTrace.step.voided")} ·{" "}
          <time dateTime={step.voided.at}>{format(step.voided.at)}</time>
          {step.voided.by && ` · ${t("labTrace.step.by", { name: step.voided.by })}`}
          {step.voided.reason && ` · ${t("labTrace.step.reason", { reason: step.voided.reason })}`}
        </span>
      )}
    </div>
  );
}

/** Installed, collected, received, counted and resulted: each step with its date and who did it. */
export function TraceTimeline({ trace }: { trace: BagTrace }) {
  const { t } = useTranslation();
  const steps = buildTimeline(trace, t);
  return (
    <section aria-label={t("labTrace.timeline")} className="flex min-w-0 flex-col gap-2">
      <h3 className="m-0 text-sm font-semibold text-ink">{t("labTrace.timeline")}</h3>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex-none">
              <StepMark step={step} />
            </span>
            <StepLine step={step} />
          </li>
        ))}
      </ol>
      {trace.lab === null && <p className="m-0 text-xs text-ink-3">{t("labTrace.step.noLab")}</p>}
    </section>
  );
}
