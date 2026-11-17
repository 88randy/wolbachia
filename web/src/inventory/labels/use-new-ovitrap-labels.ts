import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_NEW_OVITRAP_LABELS } from "../../labels/label-kinds";
import type { LabelSource } from "../../labels/label-records";
import { reportSessionError } from "../../session/session-events";
import { useToast } from "../../ui/toast-context";
import { useInventoryContext } from "../use-inventory-context";
import { OVITRAP_POOL_KEY, mintOvitrapLabels } from "./ovitrap-label-query";

const DEFAULT_COUNT = "10";

/** The whole number the person typed, or null when it is empty, partial or out of range. */
export function parseNewLabelCount(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const count = Number(text);
  return count >= 1 && count <= MAX_NEW_OVITRAP_LABELS ? count : null;
}

type Scope = ReturnType<typeof useInventoryContext>;
type MintOutcome = { status: "created"; sources: LabelSource[] } | { status: "stale" | "failed" };

/** One request: the new stickers as picker rows, or why there are none ("stale" = session moved). */
async function mintBatch(scope: Scope, cache: QueryClient, count: number) {
  const guard = scope.beginWrite();
  try {
    const labels = await mintOvitrapLabels(scope, count, guard.signal);
    if (guard.isStale()) return { status: "stale" } satisfies MintOutcome;
    await cache.invalidateQueries({
      predicate: (query) => query.queryKey.includes(OVITRAP_POOL_KEY),
    });
    const sources = labels.map((row): LabelSource => ({ kind: "ovitrap_label", row }));
    return { status: "created", sources } satisfies MintOutcome;
  } catch (error) {
    if (guard.isStale()) return { status: "stale" } satisfies MintOutcome;
    reportSessionError(error, cache);
    return { status: "failed" } satisfies MintOutcome;
  }
}

/**
 * "Generate new labels": registers a batch on the server and hands the new stickers to the
 * caller, which ticks them so they are ready to print.
 */
export function useNewOvitrapLabels(onCreated: (sources: readonly LabelSource[]) => void) {
  const scope = useInventoryContext();
  const cache = useQueryClient();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [countText, setCountText] = useState(DEFAULT_COUNT);
  const [isBusy, setBusy] = useState(false);
  const [hasFailed, setFailed] = useState(false);
  const count = parseNewLabelCount(countText);

  async function generate() {
    if (count === null || isBusy) return;
    setBusy(true);
    setFailed(false);
    const outcome: MintOutcome = await mintBatch(scope, cache, count);
    setBusy(false);
    if (outcome.status === "failed") setFailed(true);
    if (outcome.status !== "created") return;
    onCreated(outcome.sources);
    const message = t("inventory.labels.newCreated", { count: outcome.sources.length });
    showToast({ message, tone: "success" });
  }

  return { countText, setCountText, count, isBusy, hasFailed, generate };
}
