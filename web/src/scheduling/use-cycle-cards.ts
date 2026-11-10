import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import type { CycleFacts, CycleStep } from "./cycle-status";
import type { CycleStepCardProps } from "./CycleStepCard";

type Card = Omit<CycleStepCardProps, "number" | "isNext"> & { id: CycleStep["id"] };

/** The five cards of the weekly cycle with their plain-language summary and single action. */
export function useCycleCards(steps: readonly CycleStep[], facts: CycleFacts): Card[] {
  const { t } = useTranslation();
  const can = useCan();
  const stateOf = (id: CycleStep["id"]) => steps.find((step) => step.id === id)?.state ?? "pending";
  const canImport = can("risk_import.apply");
  const canManage = can("schedule.manage");
  const isRiskDone = stateOf("risk") === "done";
  const assignState = stateOf("assign");
  const reviewState = stateOf("review");
  const reassignState = stateOf("reassign");
  const cards: Card[] = [
    {
      id: "risk",
      title: t("scheduling.step.risk.title"),
      text: t("scheduling.step.risk.text"),
      state: stateOf("risk"),
      summary: isRiskDone
        ? t("scheduling.step.risk.done", { count: facts.riskCount })
        : t("scheduling.step.risk.pending"),
      actionLabel:
        canImport && !isRiskDone ? t("scheduling.step.risk.load") : t("scheduling.step.risk.see"),
      link: { to: canImport && !isRiskDone ? "/scheduling/risk/import" : "/scheduling/risk" },
    },
    {
      id: "assign",
      title: t("scheduling.step.assign.title"),
      text: t("scheduling.step.assign.text"),
      state: assignState,
      summary:
        facts.quadrantCount === 0
          ? t("scheduling.step.assign.empty")
          : assignState === "done"
            ? t("scheduling.step.assign.done", { count: facts.quadrantCount })
            : t("scheduling.step.assign.attention", {
                count: facts.unassignedCount,
                total: facts.quadrantCount,
              }),
      actionLabel:
        assignState === "done"
          ? t("scheduling.step.assign.see")
          : t("scheduling.step.assign.action"),
      link: { to: "/scheduling/assignments" },
    },
    {
      id: "review",
      title: t("scheduling.step.review.title"),
      text: t("scheduling.step.review.text"),
      state: reviewState,
      summary:
        reviewState === "done"
          ? t("scheduling.step.review.done", {
              total: facts.taskCount,
              pending: facts.pendingCount,
            })
          : t("scheduling.step.review.pending"),
      actionLabel:
        reviewState === "pending" && canManage
          ? t("scheduling.step.review.build")
          : t("scheduling.step.review.action"),
      link: { to: "/scheduling/plan" },
    },
    {
      id: "reassign",
      title: t("scheduling.step.reassign.title"),
      text: t("scheduling.step.reassign.text"),
      state: reassignState,
      summary:
        reassignState === "attention"
          ? t("scheduling.step.reassign.attention", { count: facts.pastPendingCount })
          : reassignState === "done"
            ? t("scheduling.step.reassign.done")
            : t("scheduling.step.reassign.none"),
      actionLabel:
        reassignState === "attention" && canManage
          ? t("scheduling.step.reassign.action")
          : t("scheduling.step.reassign.see"),
      link: { to: "/scheduling/plan" },
    },
    {
      id: "intervention",
      title: t("scheduling.step.intervention.title"),
      text: t("scheduling.step.intervention.text"),
      state: "optional",
      summary:
        facts.interventionCount > 0
          ? t("scheduling.step.intervention.done", { count: facts.interventionCount })
          : t("scheduling.step.intervention.empty"),
      actionLabel: t("scheduling.step.intervention.action"),
      link: { to: "/scheduling/interventions" },
    },
  ];
  return cards.filter((card) => card.id !== "intervention" || can("intervention.read"));
}
