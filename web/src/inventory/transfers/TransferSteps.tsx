import { Check, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { cn } from "@/lib/utils";
import type { Transfer } from "./transfer-query";

type StepState = "done" | "current" | "waiting" | "attention";
const STEPS = ["prepare", "send", "receive"] as const;

/** Where the shipment stands, as the three steps of its story. */
function stepStates(state: Transfer["state"]): Record<(typeof STEPS)[number], StepState> {
  if (state === "prepared") return { prepare: "done", send: "current", receive: "waiting" };
  if (state === "dispatched") return { prepare: "done", send: "done", receive: "current" };
  if (state === "discrepancy") return { prepare: "done", send: "done", receive: "attention" };
  return { prepare: "done", send: "done", receive: "done" };
}

function Marker({ state, number }: { state: StepState; number: number }) {
  const Icon = state === "done" ? Check : state === "attention" ? TriangleAlert : undefined;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 flex-none place-items-center rounded-full text-sm font-bold",
        state === "done" && "bg-success-bg text-success-fg",
        state === "current" && "bg-action text-white",
        state === "waiting" && "bg-tint text-ink-2",
        state === "attention" && "bg-warning-bg text-warning-fg",
      )}
    >
      {Icon ? <Icon className="size-4" strokeWidth={2.5} /> : number}
    </span>
  );
}

/** Prepare, send, receive: the current step is filled, done steps carry a check. */
export function TransferSteps({ state }: { state: Transfer["state"] }) {
  const { t } = useTranslation();
  const states = stepStates(state);
  return (
    <ol
      aria-label={t("transfers.steps.label")}
      className="m-0 grid list-none grid-cols-1 gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card sm:grid-cols-3"
    >
      {STEPS.map((step, index) => (
        <li
          key={step}
          aria-current={states[step] === "current" ? "step" : undefined}
          className="flex min-w-0 items-center gap-3"
        >
          <Marker state={states[step]} number={index + 1} />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm leading-5 font-semibold text-ink">
              {t(`transfers.steps.${step}.title` as MessageKey)}
            </span>
            <span className="text-[13px] leading-5 text-ink-2">
              {t(`transfers.steps.${step}.${states[step]}` as MessageKey)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
