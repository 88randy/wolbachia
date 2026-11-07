import { Power, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ACTIVE_LIMIT } from "./catalog-domain";
import type { CatalogItem } from "./catalogs-query";
import { changeAvailability } from "./catalog-availability";
import { useCatalogEditorContext } from "./catalog-editor-context";
import { CatalogActionButton } from "./CatalogActionButton";

/** Availability is reversible; blocked actions explain their limits on keyboard focus. */
export function CatalogAvailabilityButton({ item }: { item: CatalogItem }) {
  const { t } = useTranslation();
  const editor = useCatalogEditorContext();
  const isAtLimit =
    !item.is_active && editor.items.filter((row) => row.is_active).length >= ACTIVE_LIMIT;
  const isBlocked = !editor.isReady || editor.write.isBusy || isAtLimit;
  const reason = t(isAtLimit ? "catalogs.error.limit" : "catalogs.actions.busy");
  return (
    <CatalogActionButton
      label={t(item.is_active ? "catalogs.actions.deactivate" : "catalogs.actions.activate")}
      reason={isBlocked ? reason : undefined}
      onClick={() => {
        editor.setError(null);
        void changeAvailability(editor, item);
      }}
    >
      {item.is_active ? <Power aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
    </CatalogActionButton>
  );
}
