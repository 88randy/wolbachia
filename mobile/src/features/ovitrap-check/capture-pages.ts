import { canReuse, NO_PADDLE_FINDINGS, PLACEMENT_PREPARATION, PREPARATION } from "./domain.ts";
import type { Draft, Reuse, Step } from "./types.ts";
import { requiresPhoto } from "./validation.ts";

/** One page of the wizard. Each page asks ONE thing. */
export type CapturePage =
  | "point"
  | "label"
  | "prepare"
  | "finding"
  | "paddle"
  | "eggs"
  | "photo"
  | "bag"
  | "conditions"
  | "confirm";

const DETAIL_PAGES: readonly CapturePage[] = ["photo", "bag", "prepare", "conditions"];
/** Placing walks the label scan and the photo as detail pages; "prepare" is its own step. */
const PLACE_DETAIL_PAGES: readonly CapturePage[] = ["label", "photo"];

function detailKinds(draft: Draft): readonly CapturePage[] {
  return draft.mode === "place" ? PLACE_DETAIL_PAGES : DETAIL_PAGES;
}

/** The pages of this capture, in order. They change with the answers (no paddle = fewer pages). */
export function capturePages(draft: Draft): readonly CapturePage[] {
  if (draft.mode === "place") return ["point", "label", "photo", "prepare", "confirm"];
  if (NO_PADDLE_FINDINGS.includes(draft.finding)) return ["finding", "confirm"];
  const hasPaddle = draft.paddlePresent !== false;
  return [
    "finding",
    "paddle",
    ...(hasPaddle ? (["eggs"] as const) : []),
    ...(requiresPhoto(draft) ? (["photo"] as const) : []),
    ...(hasPaddle ? (["bag"] as const) : []),
    "prepare",
    "conditions",
    "confirm",
  ];
}

/** Which page the saved step shows. "details" is a group of pages walked with a local index. */
export function currentPage(draft: Draft, detailIndex: number): CapturePage {
  const details = detailPages(draft);
  const stepPage: Partial<Record<Step, CapturePage>> = {
    point: "point",
    finding: "finding",
    paddle: "paddle",
    eggs: "eggs",
    confirm: "confirm",
  };
  if (draft.step === "prepare") return "prepare";
  if (draft.step === "details")
    return details[Math.min(detailIndex, details.length - 1)] ?? "confirm";
  return stepPage[draft.step] ?? "confirm";
}

/** Number of detail pages before the last one; the wizard moves inside them before saving a step. */
export function detailPages(draft: Draft): readonly CapturePage[] {
  return capturePages(draft).filter((page) => detailKinds(draft).includes(page));
}

/** Position of the shown page for "Paso X de N". */
export function pageNumber(draft: Draft, page: CapturePage): number {
  return Math.max(1, capturePages(draft).indexOf(page) + 1);
}

function isBagValid(draft: Draft): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(draft.bagCode) && draft.paddleType !== null;
}

/** The label must be scanned; the photo of a placed trap is asked for but never blocks. */
function isEvidencePageDone(draft: Draft, page: "label" | "photo"): boolean {
  if (page === "label") return draft.labelScanned === true;
  return draft.mode === "place" || draft.evidence.length > 0;
}

/** Whether the courier has answered what this page asks, so "Siguiente" can be pressed. */
export function isPageDone(draft: Draft, page: CapturePage): boolean {
  if (page === "point") return draft.point !== null;
  if (page === "finding") return draft.finding !== "";
  if (page === "paddle") return draft.paddlePresent !== null;
  if (page === "eggs") return draft.hasEggs !== null;
  if (page === "label" || page === "photo") return isEvidencePageDone(draft, page);
  if (page === "bag") return isBagValid(draft);
  if (page === "prepare") {
    const required = draft.mode === "place" ? PLACEMENT_PREPARATION : PREPARATION;
    return required.every((key) => draft.prepared.includes(key));
  }
  return true;
}

/** The reuse options a courier may pick, from the downloaded rule. */
export function eligibleReuse(draft: Draft, reuse: readonly Reuse[]): readonly Reuse[] {
  return reuse.filter((item) => canReuse(item, draft.rules?.maxPaddleReuses ?? 2));
}
