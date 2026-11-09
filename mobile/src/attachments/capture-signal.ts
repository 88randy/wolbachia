import { EvidenceError } from "./types.ts";

export function requireCaptureSignal(signal: AbortSignal): void {
  if (signal.aborted) throw new EvidenceError("stale_context");
}
