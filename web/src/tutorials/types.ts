/** Typed data model of the how-to tutorials. Copy is never stored here: only i18n keys are derived. */

/** An edge to the next step; `edge` labels a branch of a question (yes or no). */
export type StepLink = string | { to: string; edge: "yes" | "no" };

export interface TutorialStep {
  /** Unique inside its tutorial; also the clip file name (`<step>.webm`). */
  id: string;
  /** A question with branches; drawn with a dashed outline and a question icon. */
  isDecision?: boolean;
  /** `false` when there is nothing to record (an end state, a wait). Defaults to true. */
  hasClip?: boolean;
  /** Reuse the clip recorded for a step of another tutorial (hub guides point at existing clips). */
  clipFrom?: { module: string; tutorial: string; step: string };
  /** Where the flow can go next. Empty = an end of the flow. The first link is the main path. */
  next: readonly StepLink[];
}

export interface Tutorial {
  /** Key in the registry, and the folder name under `public/tutorials/<module>/`. */
  id: string;
  module: string;
  /** The first step is `steps[0]`. Order inside a layer follows this array. */
  steps: readonly TutorialStep[];
}

export function linkTarget(link: StepLink): string {
  return typeof link === "string" ? link : link.to;
}

export function linkEdge(link: StepLink): "yes" | "no" | undefined {
  return typeof link === "string" ? undefined : link.edge;
}
