import type { Schemas } from "@wolbachia/api-client";

type Task = Schemas["Task"];
export type Risk = "high" | "medium" | "low" | "none";

export interface TaskGroup {
  quadrant: string;
  center: string;
  /** The highest risk of the quadrant's points that day. */
  risk: Risk;
  /** Where that highest risk comes from (official list or company rule), when known. */
  source: string | null;
  protocol: string | null;
  /** Points per risk, to show why the quadrant is where it is. */
  byRisk: Record<Risk, number>;
  actions: Partial<Record<Task["action"], number>>;
  done: number;
  total: number;
}

export const RISK_ORDER: Record<Risk, number> = { high: 0, medium: 1, low: 2, none: 3 };

function riskOf(task: Task): Risk {
  return task.category === "high" || task.category === "medium" || task.category === "low"
    ? task.category
    : "none";
}

/** One group per quadrant with the number of points per action, highest risk first. */
export function groupByQuadrant(
  tasks: readonly Task[],
  codeOf: (quadrant: string) => string = (id) => id,
): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const group = groups.get(task.quadrant_id) ?? {
      quadrant: task.quadrant_id,
      center: task.center_id,
      risk: "none" as Risk,
      source: null,
      protocol: null,
      byRisk: { high: 0, medium: 0, low: 0, none: 0 },
      actions: {},
      done: 0,
      total: 0,
    };
    const risk = riskOf(task);
    group.byRisk[risk] += 1;
    if (RISK_ORDER[risk] < RISK_ORDER[group.risk] || group.total === 0) {
      group.risk = risk;
      group.source = task.source;
      group.protocol = task.protocol;
    }
    group.actions[task.action] = (group.actions[task.action] ?? 0) + 1;
    if (task.is_completed) group.done += 1;
    group.total += 1;
    groups.set(task.quadrant_id, group);
  }
  return [...groups.values()].sort(
    (a, b) =>
      RISK_ORDER[a.risk] - RISK_ORDER[b.risk] ||
      codeOf(a.quadrant).localeCompare(codeOf(b.quadrant)),
  );
}
