import { useCan } from "../session/use-can";
import type { TableData } from "../data-table/table-types";
import type { CatalogItem } from "./catalogs-query";
import { useCatalogEditorContext } from "./catalog-editor-context";
import { useCatalogDrag } from "./use-catalog-drag";
import { orderedRows } from "./catalog-reorder";
import { displayLabel } from "./catalog-domain";
/** Freeze drag evidence while projecting only the current editor's reversible optimistic changes. */
export function useCatalogRows(items: TableData<CatalogItem>) {
  const can = useCan();
  const editor = useCatalogEditorContext();
  const drag = useCatalogDrag(items, editor);
  const rows = orderedRows(drag.rows, editor.optimisticOrder).map((item) =>
    editor.optimisticAvailability?.id === item.id &&
    editor.optimisticAvailability.version === item.catalog_version
      ? { ...item, is_active: editor.optimisticAvailability.isActive }
      : item,
  );
  const reorder = rows.map((item) => ({
    id: item.id,
    label: displayLabel(item, editor.language).label,
    isDisabled: !can("catalog_item.update") || !item.is_active || item.is_other,
    isBusy:
      !editor.canReorder ||
      editor.write.isBusy ||
      (!drag.isDragging && (items.isFetching || !editor.isReady)),
  }));
  return { drag, rows, reorder, resetKey: `${String(editor.revision)}:${editor.viewKey}` };
}
