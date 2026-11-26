import { Check, CircleHelp } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties, Ref } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface FlowNodeButtonProps {
  label: string;
  isDecision: boolean;
  isCurrent: boolean;
  isVisited: boolean;
  style: CSSProperties;
  delaySeconds: number;
  onSelect: () => void;
  ref?: Ref<HTMLButtonElement>;
}

function nodeClasses(isDecision: boolean, isCurrent: boolean): string {
  return cn(
    "absolute flex items-center justify-center gap-1.5 border px-2 text-center text-[13px] leading-4 font-semibold transition-colors duration-200",
    isDecision ? "rounded-full border-dashed" : "rounded-lg",
    isCurrent
      ? "border-action bg-action text-on-action shadow-xs"
      : "border-line-strong bg-surface text-ink hover:bg-tint",
  );
}

/** Screen-reader text of the node state; the visual one is an icon. */
function NodeState({
  isDecision,
  isCurrent,
  isVisited,
}: Pick<FlowNodeButtonProps, "isDecision" | "isCurrent" | "isVisited">) {
  const { t } = useTranslation();
  if (isCurrent) return <span className="sr-only">{t("tutorials.diagram.current")}</span>;
  if (isVisited) return <span className="sr-only">{t("tutorials.diagram.visited")}</span>;
  return isDecision ? <span className="sr-only">{t("tutorials.diagram.decision")}</span> : null;
}

/**
 * One step of the diagram. State is icon plus text, never color alone: a check when seen, a
 * question mark for questions, and the current step is announced with `aria-current`.
 */
export function FlowNodeButton({
  label,
  style,
  delaySeconds,
  onSelect,
  ref,
  ...state
}: FlowNodeButtonProps) {
  return (
    <motion.button
      ref={ref}
      type="button"
      aria-current={state.isCurrent ? "step" : undefined}
      onClick={onSelect}
      style={style}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delaySeconds, duration: 0.25 }}
      className={nodeClasses(state.isDecision, state.isCurrent)}
    >
      {state.isDecision && <CircleHelp aria-hidden="true" className="size-4 shrink-0" />}
      <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
      {state.isVisited && !state.isCurrent && (
        <Check aria-hidden="true" className="size-4 shrink-0 text-success-fg" />
      )}
      <NodeState {...state} />
    </motion.button>
  );
}
