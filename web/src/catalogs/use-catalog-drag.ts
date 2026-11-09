import { useState } from "react";
import type { TableData } from "../data-table/table-types";
import type { CatalogItem } from "./catalogs-query";
import type { CatalogEditor } from "./use-catalog-editor";
import { useCatalogReorder } from "./use-catalog-reorder";
/** A drag owns its displayed rows and revision until drop/cancel, including a background refresh. */
export function useCatalogDrag(items: TableData<CatalogItem>, editor: CatalogEditor) {
  const [snapshot, setSnapshot] = useState<{
    rows: readonly CatalogItem[];
    editor: CatalogEditor;
  } | null>(null);
  const move = useCatalogReorder(snapshot?.editor ?? editor);
  return {
    rows: snapshot?.rows ?? items.rows,
    isDragging: snapshot !== null,
    move: (from: string, to: string) => {
      if (editor.canReorder && (!snapshot || snapshot.editor.viewKey === editor.viewKey))
        void move(from, to);
    },
    start: () => {
      setSnapshot({ rows: items.rows, editor });
    },
    end: () => {
      setSnapshot(null);
    },
  };
}
