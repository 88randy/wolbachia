import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CatalogItem } from "./catalogs-query";
import { useCatalogEditorContext } from "./catalog-editor-context";
import { CatalogActionButton } from "./CatalogActionButton";
/** The same server permission controls label edits and the separate drag handle. */
export function CatalogEditActions({ item }: { item: CatalogItem }) {
  const { t } = useTranslation();
  const editor = useCatalogEditorContext();
  return (
    <CatalogActionButton
      label={t("catalogs.actions.edit")}
      reason={!editor.isReady || editor.write.isBusy ? t("catalogs.actions.busy") : undefined}
      onClick={() => {
        editor.setError(null);
        editor.setDialog({ kind: "edit", item });
      }}
    >
      <Pencil aria-hidden="true" />
    </CatalogActionButton>
  );
}
