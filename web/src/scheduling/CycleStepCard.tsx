import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { buttonVariants } from "../ui/button-variants";
import { StatusPill } from "../ui/StatusPill";
import type { Tone } from "../ui/tone";
import type { StepState } from "./cycle-status";

const TONE: Record<StepState, Tone> = {
  done: "success",
  pending: "info",
  attention: "warning",
  optional: "neutral",
};

export interface CycleStepCardProps {
  number: number;
  title: string;
  text: string;
  state: StepState;
  /** What is true now, in one line, with the numbers. */
  summary: string;
  actionLabel: string;
  link: Pick<LinkProps, "to" | "search">;
  /** The step to do next: its button is the one primary action of the screen. */
  isNext: boolean;
}

/** One step of the weekly cycle: what it is, how it stands this week, and one action. */
export function CycleStepCard(props: CycleStepCardProps) {
  const { number, title, text, state, summary, actionLabel, link, isNext } = props;
  const { t } = useTranslation();
  return (
    <li
      aria-current={isNext ? "step" : undefined}
      className={cn(
        "flex min-w-0 flex-wrap items-start gap-x-5 gap-y-3 rounded-2xl border bg-surface p-5 shadow-card",
        isNext ? "border-action ring-1 ring-action" : "border-line",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-10 flex-none place-items-center rounded-full text-base font-bold",
          state === "done" ? "bg-success-bg text-success-fg" : "bg-tint text-action-strong",
        )}
      >
        {state === "done" ? <Check className="size-5" strokeWidth={2.5} /> : number}
      </span>
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-2">
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs font-semibold text-ink-3">
            {t("scheduling.home.stepOf", { number })}
          </span>
          <StatusPill tone={TONE[state]}>{t(`scheduling.home.state.${state}`)}</StatusPill>
          {isNext && (
            <span className="text-xs font-semibold text-action-strong">
              {t("scheduling.home.nextBadge")}
            </span>
          )}
        </p>
        <h2 className="m-0 text-base leading-6 font-semibold text-ink">{title}</h2>
        <p className="m-0 text-sm leading-5 text-ink-2">{text}</p>
        <p className="m-0 text-sm leading-5 font-semibold text-ink">{summary}</p>
      </div>
      <Link
        {...link}
        className={cn(
          buttonVariants({ variant: isNext ? "primary" : "secondary", size: "lg" }),
          "self-center",
        )}
      >
        {actionLabel}
        <ArrowRight aria-hidden="true" />
      </Link>
    </li>
  );
}
