import { nextCheckStep, normalizePaddle } from "./domain.ts";
import type { DraftPatch } from "./types.ts";
import type { CaptureProps } from "./model.ts";
/** Choice plus automatic step change is persisted together, before the next screen appears. */
export function choose(props: CaptureProps, patch: DraftPatch): void {
  const draft = normalizePaddle({ ...props.draft, ...patch });
  void props.model.run(
    () => props.model.service.update({ ...patch, step: nextCheckStep(draft) }, draft.eventId),
    { eventId: draft.eventId },
  );
}
