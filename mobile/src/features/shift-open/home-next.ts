import type { ShiftSnapshot } from "./service.ts";

/** What the "Lo que sigue" card offers on the home screen. Pure, derived from the local shift only. */
export type HomeNext = "loading" | "openShift" | "resume" | "retry" | "route" | "closed";

export function homeNext(state: ShiftSnapshot | null): HomeNext {
  if (state === null) return "loading";
  if (state.locallyClosedAt) return "closed";
  if (state.opening?.status === "rejected") return "retry";
  if (state.opening) return "route";
  return state.draft ? "resume" : "openShift";
}
