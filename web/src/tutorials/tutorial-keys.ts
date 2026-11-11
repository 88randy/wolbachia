import type { MessageKey } from "@wolbachia/i18n";

/** i18n key of a tutorial title. A test checks every derived key exists in both locales. */
export function titleKey(tutorialId: string): MessageKey {
  return `tutorials.${tutorialId}.title` as MessageKey;
}

/** i18n key of the short label or the one-line caption of a step. */
export function stepKey(tutorialId: string, stepId: string, part: "label" | "caption"): MessageKey {
  return `tutorials.${tutorialId}.${stepId}.${part}` as MessageKey;
}

/** Public URL of the clip (and its poster) of one step. */
export function clipUrls(module: string, tutorialId: string, stepId: string) {
  const base = `/tutorials/${module}/${tutorialId}/${stepId}`;
  return { video: `${base}.webm`, poster: `${base}.webp` };
}
