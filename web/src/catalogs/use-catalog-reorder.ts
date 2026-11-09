import type { SessionGuard } from "../session/use-session-guard";
import { dragOrderedIds, writeOrder } from "./catalog-reorder";
import type { CatalogEditor } from "./use-catalog-editor";
/** Undo is conditional on our returned revision and the originating session, including after refresh. */
export function useCatalogReorder(editor: CatalogEditor) {
  return async (from: string, to: string) => {
    const orderedIds = dragOrderedIds(editor.items, from, to);
    if (
      !editor.isCurrent() ||
      !editor.isReady ||
      !editor.canReorder ||
      orderedIds.length === 0 ||
      editor.write.isLocked()
    )
      return;
    const guard = editor.begin();
    const previous = editor.items
      .filter((item) => item.is_active && !item.is_other)
      .map((item) => item.id);
    editor.setError(null);
    editor.setOptimisticOrder(orderedIds);
    const { outcome, writtenVersion } = await writeOrder(editor, orderedIds);
    if (outcome.kind === "stale") return;
    editor.setOptimisticOrder(null);
    if (outcome.kind === "failed") {
      editor.setError(outcome.key);
      return;
    }
    offerUndo(editor, guard, { previous, writtenVersion });
  };
}

function offerUndo(
  editor: CatalogEditor,
  guard: SessionGuard,
  order: { previous: string[]; writtenVersion: number | undefined },
) {
  const { previous, writtenVersion } = order;
  editor.toast.showToast({
    message: editor.t("refresh.reorder.saved"),
    action:
      writtenVersion === undefined
        ? undefined
        : {
            label: editor.t("refresh.reorder.undo"),
            onAction: () => {
              if (guard.isStale()) return;
              void writeOrder(editor, previous, writtenVersion).then(({ outcome: undone }) => {
                if (undone.kind === "failed") editor.setError(undone.key);
              });
            },
          },
  });
}
