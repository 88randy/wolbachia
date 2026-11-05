import { ImmutableCaptureError } from "./draft-buffer.ts";
import type { StoredCapture } from "./store.ts";
/** A command may only act on the capture that its caller displayed. */
export class StaleCaptureError extends ImmutableCaptureError {
  constructor() {
    super();
    this.name = "StaleCaptureError";
  }
}
export function assertCaptureIdentity(state: StoredCapture, eventId: string | null): void {
  if ((state.draft?.eventId ?? null) !== eventId) throw new StaleCaptureError();
}
