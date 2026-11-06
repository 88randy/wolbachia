import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";

import { ACTIVE_LIMIT } from "./catalog-domain";
import type { CatalogEditor } from "./use-catalog-editor";
import { CatalogActionButton } from "./CatalogActionButton";

/** Permission hides the control; catalog limits and loading explain why it is unavailable. */
export function CatalogAddButton({ editor, isReady }: { editor: CatalogEditor; isReady: boolean }) {
  const { t } = useTranslation();
  const can = useCan();
  if (!can("catalog_item.create")) return null;
  const isAtLimit = editor.items.filter((item) => item.is_active).length >= ACTIVE_LIMIT;
  const isBlocked = isAtLimit || editor.write.isBusy || !isReady;
  const reasonKey = isAtLimit
    ? "catalogs.error.limit"
    : editor.write.isBusy
      ? "catalogs.actions.busy"
      : "catalogs.page.loading";
  return (
    <CatalogActionButton
      variant="primary"
      size="md"
      reason={isBlocked ? t(reasonKey) : undefined}
      onClick={() => {
        editor.setError(null);
        editor.setDialog({ kind: "create" });
      }}
    >
      {t("catalogs.actions.add")}
    </CatalogActionButton>
  );
}
