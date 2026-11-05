import { createContext, useContext } from "react";
import type { CatalogEditor } from "./use-catalog-editor";
export const CatalogEditorContext = createContext<CatalogEditor | null>(null);
/** Stable table cell components read the current editor without recreating their renderer. */
export function useCatalogEditorContext(): CatalogEditor {
  const editor = useContext(CatalogEditorContext);
  if (!editor) throw new Error("Catalog editor context is missing");
  return editor;
}
