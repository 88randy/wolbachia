import type { CatalogEditor } from "./use-catalog-editor";
import { CatalogItemDialog } from "./CatalogItemDialog";
import { DeactivateDialog } from "./DeactivateDialog";
/** One dialog per editor; closing it preserves the table and its stable action nodes. */
export function CatalogEditorDialogs({ editor }: { editor: CatalogEditor }) {
  const { dialog } = editor;
  if (!dialog) return null;
  if (dialog.kind === "create") return <CatalogItemDialog editor={editor} />;
  if (dialog.kind === "edit") return <CatalogItemDialog editor={editor} item={dialog.item} />;
  return <DeactivateDialog editor={editor} item={dialog.item} />;
}
