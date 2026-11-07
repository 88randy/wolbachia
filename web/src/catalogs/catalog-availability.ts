import type { CatalogEditor } from "./use-catalog-editor";
import type { CatalogItem } from "./catalogs-query";
import { writeAvailability } from "./catalog-availability-write";
import type { AvailabilityIntent } from "./catalog-availability-write";
import type { SessionGuard } from "../session/use-session-guard";
import type { CatalogOutcome } from "./catalog-outcome";

/** Initial intent uses the displayed item; Undo uses only its own successful receipt. */
export function changeAvailability(editor: CatalogEditor, item: CatalogItem) {
  if (item.is_other || !Number.isSafeInteger(item.catalog_version) || item.catalog_version < 0)
    return;
  const intent = {
    path: { ...editor.path(item.id) },
    isActive: !item.is_active,
    version: item.catalog_version,
  };
  return applyAvailability(editor, intent, true);
}
async function applyAvailability(
  editor: CatalogEditor,
  intent: AvailabilityIntent,
  canUndo: boolean,
) {
  if (!editor.isCurrent() || !editor.isAvailabilityReady() || editor.write.isLocked()) return;
  if (!editor.canChangeAvailability(intent.isActive)) return;
  const guard = editor.beginAvailability();
  editor.setError(null);
  editor.setAnnouncement("");
  editor.setOptimisticAvailability({
    id: intent.path.id,
    isActive: intent.isActive,
    version: intent.version,
  });
  const { outcome, receipt, uncertain } = await writeAvailability(editor, intent, guard);
  if (outcome.kind === "stale" || guard.isStale()) return;
  editor.setOptimisticAvailability(null);
  const error = availabilityError(outcome, uncertain);
  if (error) {
    editor.setError(error);
    return;
  }
  publishSaved(editor, { receipt, guard, canUndo });
}
function availabilityError(outcome: CatalogOutcome, uncertain: boolean) {
  if (uncertain) return "refresh.availability.uncertain";
  if (outcome.kind !== "failed") return;
  return outcome.key === "catalogs.error.versionConflict"
    ? "refresh.availability.conflict"
    : outcome.key;
}
interface SavedOptions {
  receipt: AvailabilityIntent | undefined;
  guard: SessionGuard;
  canUndo: boolean;
}
function publishSaved(editor: CatalogEditor, { receipt, guard, canUndo }: SavedOptions) {
  editor.setDialog(null);
  editor.setAnnouncement(editor.t("catalogs.actions.saved"));
  editor.toast.showToast({
    message: editor.t("catalogs.actions.saved"),
    action:
      canUndo && receipt && editor.canChangeAvailability(!receipt.isActive)
        ? {
            label: editor.t("refresh.reorder.undo"),
            onAction: () => {
              if (!guard.isStale())
                void applyAvailability(editor, { ...receipt, isActive: !receipt.isActive }, false);
            },
          }
        : undefined,
  });
}
