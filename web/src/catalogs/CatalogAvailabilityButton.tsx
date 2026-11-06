import { useTranslation } from "react-i18next";
import { ACTIVE_LIMIT } from "./catalog-domain";
import type { CatalogItem } from "./catalogs-query";
import { changeAvailability } from "./use-catalog-editor";
import { useCatalogEditorContext } from "./catalog-editor-context";
import { CatalogActionButton } from "./CatalogActionButton";

/** Reactivation is direct; deactivation opens plain confirmation. Limits remain visible. */
export function CatalogAvailabilityButton({ item }: { item: CatalogItem }) {
  const { t } = useTranslation();
  const editor = useCatalogEditorContext();
  const isAtLimit =
    !item.is_active && editor.items.filter((row) => row.is_active).length >= ACTIVE_LIMIT;
  const isBlocked = editor.write.isBusy || isAtLimit;
  const reason = t(isAtLimit ? "catalogs.error.limit" : "catalogs.actions.busy");
  return (
    <CatalogActionButton
      variant="ghost"
      size="sm"
      reason={isBlocked ? reason : undefined}
      onClick={() => {
        editor.setError(null);
        if (item.is_active) editor.setDialog({ kind: "deactivate", item });
        else void changeAvailability(editor, item);
      }}
    >
      {t(item.is_active ? "catalogs.actions.deactivate" : "catalogs.actions.activate")}
    </CatalogActionButton>
  );
}
