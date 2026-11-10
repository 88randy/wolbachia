import type { Schemas } from "@wolbachia/api-client";

type Task = Schemas["Task"];
export type Risk = "high" | "medium" | "low" | "none";

export interface TaskGroup {
  quadrant: string;
  risk: Risk;
  actions: Partial<Record<Task["action"], number>>;
  done: number;
}

const RISK_ORDER: Record<Risk, number> = { high: 0, medium: 1, low: 2, none: 3 };

function riskOf(task: Task): Risk {
  return task.category === "high" || task.category === "medium" || task.category === "low"
    ? task.category
    : "none";
}

/** One group per quadrant with the number of points per action, highest risk first. */
export function groupByQuadrant(tasks: readonly Task[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const group = groups.get(task.quadrant_id) ?? {
      quadrant: task.quadrant_id,
      risk: "none" as Risk,
      actions: {},
      done: 0,
    };
    const risk = riskOf(task);
    if (RISK_ORDER[risk] < RISK_ORDER[group.risk]) group.risk = risk;
    group.actions[task.action] = (group.actions[task.action] ?? 0) + 1;
    if (task.is_completed) group.done += 1;
    groups.set(task.quadrant_id, group);
  }
  return [...groups.values()].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
}
