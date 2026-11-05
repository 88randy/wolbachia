import { displayLabel, moveOrderedIds } from "./catalog-domain";
import type { Direction } from "./catalog-domain";
import type { CatalogItem } from "./catalogs-query";
import type { CatalogEditor } from "./use-catalog-editor";

/** A single request keeps every sort change in the same server transaction. */
async function writeOrder(editor: CatalogEditor, orderedIds: string[]) {
  return editor.write.run((guard) =>
    editor.write.send(
      () =>
        editor.client.POST("/api/v1/catalogs/{catalog_slug}/items/reorder/", {
          params: { path: { catalog_slug: editor.slug } },
          body: { version: editor.version, ordered_ids: orderedIds },
          signal: guard.signal,
        }),
      guard,
    ),
  );
}

/** useCatalogWrite refreshes both catalog and items, including after a version conflict. */
export async function moveItem(editor: CatalogEditor, item: CatalogItem, direction: Direction) {
  const orderedIds = moveOrderedIds(editor.items, item.id, direction);
  if (orderedIds.length === 0) return;
  editor.setError(null);
  editor.setAnnouncement("");
  const outcome = await writeOrder(editor, orderedIds);
  if (outcome.kind === "stale") return;
  if (outcome.kind === "failed") {
    editor.setError(outcome.key);
    return;
  }
  editor.setAnnouncement(
    editor.t(direction === "up" ? "catalogs.actions.movedUp" : "catalogs.actions.movedDown", {
      name: displayLabel(item, editor.language).label,
    }),
  );
}
