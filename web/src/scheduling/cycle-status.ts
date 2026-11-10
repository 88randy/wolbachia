import type { DayLoad } from "./scheduling-queries";

export type StepState = "done" | "pending" | "attention" | "optional";
export type StepId = "risk" | "assign" | "review" | "reassign" | "intervention";

export interface CycleFacts {
  riskCount: number;
  quadrantCount: number;
  unassignedCount: number;
  taskCount: number;
  pendingCount: number;
  /** Pending points of days before today. */
  pastPendingCount: number;
  interventionCount: number;
}

export interface CycleStep {
  id: StepId;
  state: StepState;
}

const SUM = (total: number, value: number) => total + value;
const pendingOf = (entry: DayLoad) => entry.loads.map((row) => row.load).reduce(SUM, 0);

/** Totals of the week from the per-day loads: all points, pending ones and pending of past days. */
export function weekFacts(days: readonly string[], perDay: readonly DayLoad[], today: string) {
  return {
    taskCount: perDay.map((entry) => entry.count).reduce(SUM, 0),
    pendingCount: perDay.map(pendingOf).reduce(SUM, 0),
    pastPendingCount: perDay
      .map((entry, index) => ((days[index] ?? today) < today ? pendingOf(entry) : 0))
      .reduce(SUM, 0),
  };
}

function assignState(facts: CycleFacts): CycleStep["state"] {
  if (facts.quadrantCount === 0) return "pending";
  return facts.unassignedCount > 0 ? "attention" : "done";
}

function reassignState(facts: CycleFacts): CycleStep["state"] {
  if (facts.pastPendingCount > 0) return "attention";
  return facts.taskCount > 0 ? "done" : "pending";
}

/** The state of each of the five steps; the first one that is not done is what comes next. */
export function cycleSteps(facts: CycleFacts): CycleStep[] {
  return [
    { id: "risk", state: facts.riskCount > 0 ? "done" : "pending" },
    { id: "assign", state: assignState(facts) },
    { id: "review", state: facts.taskCount > 0 ? "done" : "pending" },
    { id: "reassign", state: reassignState(facts) },
    { id: "intervention", state: "optional" },
  ];
}

/** The step to do next: the first of 1-4 that is not done (the fifth is optional). */
export function nextStep(steps: readonly CycleStep[]): CycleStep | undefined {
  return steps.find((step) => step.id !== "intervention" && step.state !== "done");
}
