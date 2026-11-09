import type { CatalogItem } from "./catalogs-query";
import type { CatalogEditor } from "./use-catalog-editor";
/** Move across the active list while keeping inactive/Other sorts under server ownership. */
export function dragOrderedIds(items: readonly CatalogItem[], from: string, to: string) {
  const ids = items.filter((item) => item.is_active && !item.is_other).map((item) => item.id);
  const start = ids.indexOf(from);
  const end = ids.indexOf(to);
  if (start < 0 || end < 0 || start === end) return [];
  ids.splice(start, 1);
  ids.splice(end, 0, from);
  return ids;
}
/** Conditional Undo uses the revision returned by this write, never a newer cached version. */
export async function writeOrder(editor: CatalogEditor, orderedIds: string[], version?: number) {
  const expected = version ?? editor.displayedVersion;
  let writtenVersion: number | undefined;
  const outcome = await editor.write.run((guard) =>
    editor.write.send(async () => {
      const result = await editor.client.POST("/api/v1/catalogs/{catalog_slug}/items/reorder/", {
        params: { path: { catalog_slug: editor.slug } },
        body: { version: expected, ordered_ids: orderedIds },
        signal: guard.signal,
      });
      writtenVersion = result.data?.version;
      return result;
    }, guard),
  );
  return { outcome, writtenVersion };
}

/** The optimistic projection only replaces active slots, retaining fixed and inactive positions. */
export function orderedRows(items: readonly CatalogItem[], order: readonly string[] | null) {
  if (!order) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const visibleOrder = order.filter((id) => byId.has(id));
  let index = 0;
  return items.map((item) => {
    if (!item.is_active || item.is_other) return item;
    const id = visibleOrder[index++];
    return id === undefined ? item : (byId.get(id) ?? item);
  });
}
