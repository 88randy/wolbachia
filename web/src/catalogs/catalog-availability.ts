import type { CatalogEditor } from "./use-catalog-editor";
import type { CatalogItem } from "./catalogs-query";
/** A fixed item has no controls; permitted state changes use the action endpoints with no body. */
export async function changeAvailability(editor: CatalogEditor, item: CatalogItem, canUndo = true) {
  if (!editor.isCurrent() || !editor.isReady || editor.write.isLocked()) return;
  const guard = editor.begin();
  editor.setOptimisticAvailability({ id: item.id, isActive: !item.is_active });
  const outcome = await sendAvailability(editor, item);
  if (outcome.kind === "stale") return;
  editor.setOptimisticAvailability(null);
  if (outcome.kind === "failed") editor.setError(outcome.key);
  else {
    editor.setDialog(null);
    editor.setAnnouncement(editor.t("catalogs.actions.saved"));
    if (canUndo)
      editor.toast.showToast({
        message: editor.t("catalogs.actions.saved"),
        action: {
          label: editor.t("refresh.reorder.undo"),
          onAction: () => {
            if (!guard.isStale())
              void changeAvailability(editor, { ...item, is_active: !item.is_active }, false);
          },
        },
      });
  }
}

function sendAvailability(editor: CatalogEditor, item: CatalogItem) {
  return editor.write.run((guard) =>
    editor.write.send(
      () =>
        item.is_active
          ? editor.client.POST("/api/v1/catalogs/{catalog_slug}/items/{id}/deactivate/", {
              params: { path: editor.path(item.id) },
              signal: guard.signal,
            })
          : editor.client.POST("/api/v1/catalogs/{catalog_slug}/items/{id}/activate/", {
              params: { path: editor.path(item.id) },
              signal: guard.signal,
            }),
      guard,
    ),
  );
}
