import type { StoredCapture } from "./store.ts";
export class ImmutableCaptureError extends Error {
  constructor() {
    super("The capture changed or is immutable; pending edits were not saved.");
    this.name = "ImmutableCaptureError";
  }
}
/** A command may only act on the capture that its caller displayed. */
export class StaleCaptureError extends ImmutableCaptureError {
  constructor() {
    super();
    this.name = "StaleCaptureError";
  }
}
export class ConcurrentCaptureError extends Error {
  constructor() {
    super("The unsaved capture changed concurrently; retry the pending edit.");
    this.name = "ConcurrentCaptureError";
  }
}
export function assertCaptureIdentity(
  state: Pick<StoredCapture, "draft" | "event">,
  eventId: string | null,
): void {
  if ((state.draft?.eventId ?? null) !== eventId) throw new StaleCaptureError();
}
