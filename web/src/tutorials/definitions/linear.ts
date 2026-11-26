import type { Tutorial } from "../types";

/** A tutorial whose steps follow one another in a straight line; every step has a clip. */
export function linear(module: string, id: string, steps: readonly string[]): Tutorial {
  return {
    id,
    module,
    steps: steps.map((step, index) => ({
      id: step,
      next: steps[index + 1] ? [steps[index + 1] as string] : [],
    })),
  };
}
