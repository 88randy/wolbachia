import { useTranslation } from "react-i18next";
import type { CatalogItem } from "./catalogs-query";
import { useCatalogEditorContext } from "./catalog-editor-context";
import { CatalogMoveButton } from "./CatalogMoveButton";
import { CatalogActionButton } from "./CatalogActionButton";

/** The permission that allows label edits also allows sort edits. */
export function CatalogEditActions({ item }: { item: CatalogItem }) {
  const { t } = useTranslation();
  const editor = useCatalogEditorContext();
  return (
    <>
      <CatalogActionButton
        variant="ghost"
        size="sm"
        reason={editor.write.isBusy ? t("catalogs.actions.busy") : undefined}
        onClick={() => {
          editor.setError(null);
          editor.setDialog({ kind: "edit", item });
        }}
      >
        {t("catalogs.actions.edit")}
      </CatalogActionButton>
      {item.is_active && (
        <>
          <CatalogMoveButton editor={editor} item={item} direction="up" />
          <CatalogMoveButton editor={editor} item={item} direction="down" />
        </>
      )}
    </>
  );
}
