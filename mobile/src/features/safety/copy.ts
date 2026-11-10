import type { BlockingLevel, GlobalCause, NextAction } from "./global-state.ts";

/** Message keys follow `area.screen.element`, so the cause or action is appended in camelCase. */
function capitalize<Word extends string>(word: Word): Capitalize<Word> {
  return (word.charAt(0).toUpperCase() + word.slice(1)) as Capitalize<Word>;
}

export const causeKey = (cause: GlobalCause) => `mobile.global.cause${capitalize(cause)}` as const;
export const nextKey = (next: NextAction) => `mobile.global.next${capitalize(next)}` as const;
export const levelKey = (level: BlockingLevel) =>
  `mobile.global.level${capitalize(level)}` as const;
