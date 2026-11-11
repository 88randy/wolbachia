import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { stepKey } from "./tutorial-keys";
import { linkEdge, linkTarget } from "./types";
import type { Tutorial, TutorialStep } from "./types";

interface StepListProps {
  tutorial: Tutorial;
  currentId: string;
  visited: ReadonlySet<string>;
  onSelect: (id: string) => void;
}

/** "Yes: Done, No: Difference": where a step leads, in words. */
function useNextText(tutorial: Tutorial) {
  const { t } = useTranslation();
  return (step: TutorialStep): string => {
    if (step.next.length === 0) return t("tutorials.list.end");
    const parts = step.next.map((link) => {
      const edge = linkEdge(link);
      const name = t(stepKey(tutorial.id, linkTarget(link), "label"));
      return edge ? `${t(`tutorials.edge.${edge}`)}: ${name}` : name;
    });
    return t("tutorials.list.then", { steps: parts.join(", ") });
  };
}

interface ItemProps {
  position: number;
  label: string;
  nextText: string;
  isCurrent: boolean;
  isVisited: boolean;
  onSelect: () => void;
}

const ITEM_CLASS =
  "flex min-h-[var(--web-control-sm)] w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] leading-5";

function StepListItem({ position, label, nextText, isCurrent, isVisited, onSelect }: ItemProps) {
  const { t } = useTranslation();
  const tone = isCurrent
    ? "bg-tint font-semibold text-action-strong"
    : "text-ink hover:bg-surface-muted";
  return (
    <li>
      <button
        type="button"
        aria-current={isCurrent ? "step" : undefined}
        onClick={onSelect}
        className={cn(ITEM_CLASS, tone)}
      >
        <span className="w-5 shrink-0 text-ink-3" aria-hidden="true">
          {position}.
        </span>
        <span className="min-w-0 flex-1">
          <span className="block [overflow-wrap:anywhere]">{label}</span>
          <span className="block text-xs font-normal text-ink-2">{nextText}</span>
        </span>
        {isVisited && (
          <Check
            aria-label={t("tutorials.diagram.visited")}
            className="mt-0.5 size-4 shrink-0 text-success-fg"
          />
        )}
      </button>
    </li>
  );
}

/** The step list: also the text equivalent of the diagram, with where each step leads. */
export function StepList({ tutorial, currentId, visited, onSelect }: StepListProps) {
  const { t } = useTranslation();
  const nextText = useNextText(tutorial);
  return (
    <nav aria-label={t("tutorials.list.title")} className="min-w-0">
      <h3 className="m-0 mb-2 text-sm font-semibold text-ink">{t("tutorials.list.title")}</h3>
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {tutorial.steps.map((step, index) => (
          <StepListItem
            key={step.id}
            position={index + 1}
            label={t(stepKey(tutorial.id, step.id, "label"))}
            nextText={nextText(step)}
            isCurrent={step.id === currentId}
            isVisited={visited.has(step.id)}
            onSelect={() => {
              onSelect(step.id);
            }}
          />
        ))}
      </ol>
    </nav>
  );
}
