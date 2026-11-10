import type { StorageLevel } from "./global-state.ts";

const MB = 1024 * 1024;
/** [ASSUMPTION] Free-space bounds until the client versions them: photos need room before the disk is full. */
export const STORAGE_FULL_BYTES = 20 * MB;
export const STORAGE_LOW_BYTES = 200 * MB;

export function deriveStorageLevel(freeBytes: number | null): StorageLevel {
  if (freeBytes === null || !Number.isFinite(freeBytes) || freeBytes < 0) return "unknown";
  if (freeBytes < STORAGE_FULL_BYTES) return "full";
  return freeBytes < STORAGE_LOW_BYTES ? "low" : "ok";
}
