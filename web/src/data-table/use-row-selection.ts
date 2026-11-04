import type { RowSelectionState } from "@tanstack/react-table";
import { useState } from "react";

type Update = RowSelectionState | ((previous: RowSelectionState) => RowSelectionState);

/**
 * The selection of rows of one page. It belongs to the rows it was made on: when a new page, a
 * new filter or a refetch brings other rows, the selection starts empty (a selected row the user
 * can no longer see must never receive an action).
 */
export function useRowSelection(rows: readonly unknown[]) {
  const [held, setHeld] = useState<{ rows: readonly unknown[]; selection: RowSelectionState }>({
    rows,
    selection: {},
  });
  if (held.rows !== rows) setHeld({ rows, selection: {} });
  const change = (update: Update): void => {
    setHeld({ rows, selection: typeof update === "function" ? update(held.selection) : update });
  };
  return [held.selection, change] as const;
}
