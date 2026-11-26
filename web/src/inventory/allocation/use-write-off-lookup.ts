import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reportSessionError } from "../../session/session-events";
import { findBag, findLot } from "./allocation-query";
import type { AllocationScope } from "./allocation-query";
import type { Bag, Lot } from "./write-off-draft";

export type LookupState = "idle" | "loading" | "notFound" | "failed";
export type Found = { kind: "lot"; lot: Lot } | { kind: "bag"; bag: Bag };

async function resolveCode(
  scope: AllocationScope,
  request: { kind: "lot" | "bag"; code: string },
  signal: AbortSignal,
): Promise<Found | null> {
  if (request.kind === "lot") {
    const lot = await findLot(scope, request.code, signal);
    return lot && { kind: "lot", lot };
  }
  const bag = await findBag(scope, request.code, signal);
  return bag && { kind: "bag", bag };
}

/** Human codes resolve only through the scoped exact collection: unknown and foreign look the same. */
export function useWriteOffLookup(scope: AllocationScope) {
  const cache = useQueryClient();
  const [state, setState] = useState<LookupState>("idle");
  const [found, setFound] = useState<Found | null>(null);
  /** Resolves a code; gives the record it found (null when none, or when this answer is stale). */
  async function find(kind: "lot" | "bag", code: string): Promise<Found | null> {
    const guard = scope.beginWrite();
    setFound(null);
    if (guard.isStale() || code.trim() === "") return null;
    setState("loading");
    try {
      const value = await resolveCode(scope, { kind, code: code.trim() }, guard.signal);
      if (guard.isStale() || !scope.isCurrentRead()) return null;
      setFound(value);
      setState(value ? "idle" : "notFound");
      return value;
    } catch (error) {
      if (guard.isStale() || !scope.isCurrentRead()) return null;
      setState("failed");
      reportSessionError(error, cache);
      return null;
    }
  }
  const clear = () => {
    setFound(null);
    setState("idle");
  };
  return { state, found, find, clear };
}
