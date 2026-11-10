import type { MessageKey } from "@wolbachia/i18n";
import type { Tone } from "../../ui/tone";
import type { Release } from "./releases-query";

export interface ReleaseStatus {
  tone: Tone;
  labelKey: MessageKey;
}

/** A release the server accepted has no blockers; any blocker means it still waits for review. */
export function releaseStatus(row: Pick<Release, "blocked_by">): ReleaseStatus {
  return row.blocked_by.length === 0
    ? { tone: "success", labelKey: "releases.status.accepted" }
    : { tone: "warning", labelKey: "releases.status.inReview" };
}

/** `location` is `[lng, lat]` in the API (typed unknown); anything else means "no point". */
export function releasePoint(row: Pick<Release, "location">): { lng: number; lat: number } | null {
  const value = row.location;
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [lng, lat] = value as unknown[];
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  return { lng, lat };
}
