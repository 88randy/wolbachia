import { useTranslation } from "react-i18next";
import { displayLabel, moveOrderedIds } from "./catalog-domain";
import type { Direction } from "./catalog-domain";
import type { CatalogItem } from "./catalogs-query";
import { moveItem } from "./catalog-reorder";
import type { CatalogEditor } from "./use-catalog-editor";
import { CatalogActionButton } from "./CatalogActionButton";
import styles from "./catalogs.module.css";
interface Props {
  editor: CatalogEditor;
  item: CatalogItem;
  direction: Direction;
}
/** A focusable aria-disabled button preserves keyboard focus after reaching an end. */
export function CatalogMoveButton({ editor, item, direction }: Props) {
  const { t } = useTranslation();
  const name = displayLabel(item, editor.language).label;
  const isEnd = moveOrderedIds(editor.items, item.id, direction).length === 0;
  const isBlocked = isEnd || editor.write.isBusy;
  const reason = editor.write.isBusy
    ? t("catalogs.actions.busy")
    : t(direction === "up" ? "catalogs.actions.first" : "catalogs.actions.last");
  const label = t(direction === "up" ? "catalogs.actions.moveUp" : "catalogs.actions.moveDown", {
    name,
  });
  return (
    <CatalogActionButton
      className={styles.action}
      isFocusableWhenBlocked
      reason={isBlocked ? reason : undefined}
      aria-label={label}
      onClick={() => {
        void moveItem(editor, item, direction);
      }}
    >
      {t(direction === "up" ? "catalogs.actions.up" : "catalogs.actions.down")}
    </CatalogActionButton>
  );
}
