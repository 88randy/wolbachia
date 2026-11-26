import { useState } from "react";
import { capturePages, currentPage, detailPages, isPageDone, pageNumber } from "./capture-pages.ts";
import { nextCheckStep, NO_PADDLE_FINDINGS } from "./domain.ts";
import type { CaptureProps } from "./model.ts";
import type { Step } from "./types.ts";

const PLACE_NEXT: Partial<Record<Step, Step>> = { point: "details", details: "prepare" };

/**
 * Walks the pages of a capture. The big choices (finding, paddle, eggs) move on by themselves; the
 * "details" step is split in small pages with a local position, and every move is saved first.
 */
export function useCaptureFlow({ model, draft }: CaptureProps) {
  const [detailIndex, setDetailIndex] = useState(0);
  const page = currentPage(draft, detailIndex);
  const pages = capturePages(draft);
  const details = detailPages(draft);
  const saveStep = (step: Step) => {
    void model.run(() => model.service.update({ step }, draft.eventId), { eventId: draft.eventId });
  };
  const next = () => {
    if (draft.step === "details" && detailIndex < details.length - 1) {
      setDetailIndex(detailIndex + 1);
      return;
    }
    if (draft.mode === "place") saveStep(PLACE_NEXT[draft.step] ?? "confirm");
    else saveStep(nextCheckStep(draft));
    setDetailIndex(0);
  };
  const back = () => {
    if (draft.step === "details" && detailIndex > 0) {
      setDetailIndex(detailIndex - 1);
      return;
    }
    const steps: Record<string, Step> =
      draft.mode === "place"
        ? { details: "point", prepare: "details", confirm: "prepare" }
        : {
            paddle: "finding",
            eggs: "paddle",
            details: draft.paddlePresent ? "eggs" : "paddle",
            confirm: NO_PADDLE_FINDINGS.includes(draft.finding) ? "finding" : "details",
          };
    const target = steps[draft.step];
    if (target !== undefined) {
      setDetailIndex(target === "details" ? Math.max(details.length - 1, 0) : 0);
      saveStep(target);
    }
  };
  return {
    page,
    number: pageNumber(draft, page),
    total: pages.length,
    isFirst: pages[0] === page,
    isLast: page === "confirm",
    isDone: isPageDone(draft, page),
    next,
    back,
  };
}
