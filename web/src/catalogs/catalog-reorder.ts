import { displayLabel, planMove } from "./catalog-domain";
import type { Direction } from "./catalog-domain";
import type { CatalogItem } from "./catalogs-query";
import type { CatalogEditor } from "./use-catalog-editor";

/** Non-atomic writes may partially succeed; useCatalogWrite refetches failures instead of rollback. */
async function writeSorts(editor: CatalogEditor, patches: ReturnType<typeof planMove>) {
  return editor.write.run(async (guard) => {
    for (const patch of patches) {
      if (guard.isStale()) return { kind: "stale" };
      const result = await editor.write.send(
        () =>
          editor.client.PATCH("/api/v1/catalogs/{catalog_slug}/items/{id}/", {
            params: { path: editor.path(patch.id) },
            body: { sort: patch.sort },
            signal: guard.signal,
          }),
        guard,
      );
      if (result.kind !== "saved") return result;
    }
    return { kind: "saved" };
  });
}

/** Guard between PATCHes: a new session cannot send the next write of an older operation. */
export async function moveItem(editor: CatalogEditor, item: CatalogItem, direction: Direction) {
  const patches = planMove(editor.items, item.id, direction);
  if (patches.length === 0) return;
  editor.setError(null);
  editor.setAnnouncement("");
  const outcome = await writeSorts(editor, patches);
  if (outcome.kind === "stale") return;
  if (outcome.kind === "failed") {
    editor.setError("catalogs.error.reorder");
    return;
  }
  editor.setAnnouncement(
    editor.t(direction === "up" ? "catalogs.actions.movedUp" : "catalogs.actions.movedDown", {
      name: displayLabel(item, editor.language).label,
    }),
  );
}
