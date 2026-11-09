import { StaleCaptureError, ImmutableCaptureError } from "../ovitrap-check/capture-identity.ts";
import type { StoredLifecycle, LifecycleDraft } from "./types.ts";
export { StaleCaptureError, ImmutableCaptureError };
export function assertIdentity(
  state: Pick<StoredLifecycle, "draft">,
  eventId: string | null,
): void {
  if ((state.draft?.eventId ?? null) !== eventId) throw new StaleCaptureError();
}
export function editable(state: StoredLifecycle): LifecycleDraft {
  if (!state.draft || state.event) throw new ImmutableCaptureError();
  return state.draft;
}
