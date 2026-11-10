import type { MessageKey } from "@wolbachia/i18n";
import { actionErrorKey as captureErrorKey } from "../ovitrap-check/action-error-key.ts";
export class EvidenceUnavailableError extends Error {}
export class LifecycleGateError extends Error {
  readonly gate: string;
  constructor(gate: string) {
    super(`Lifecycle blocked: ${gate}`);
    this.gate = gate;
  }
}
export function actionErrorKey(error: unknown): MessageKey {
  if (error instanceof LifecycleGateError && error.gate === "training")
    return "trainings.mobile.boundary";
  if (error instanceof EvidenceUnavailableError) return "mobile.lifecycle.noCamera";
  if (error instanceof LifecycleGateError)
    return error.gate === "scope" ? "mobile.lifecycle.scopeBlocked" : "mobile.lifecycle.incomplete";
  return captureErrorKey(error);
}
