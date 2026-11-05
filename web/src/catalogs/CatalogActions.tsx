import { useCan } from "../session/use-can";
import type { CatalogItem } from "./catalogs-query";
import { CatalogEditActions } from "./CatalogEditActions";
import { CatalogAvailabilityButton } from "./CatalogAvailabilityButton";
import styles from "./catalogs.module.css";

/** Check permission codes, never profiles. Fixed Other has no actions. */
export function CatalogActions({ item }: { item: CatalogItem }) {
  const can = useCan();
  if (item.is_other) return null;
  return (
    <div className={styles.actions}>
      {can("catalog_item.update") && <CatalogEditActions item={item} />}
      {can(item.is_active ? "catalog_item.deactivate" : "catalog_item.activate") && (
        <CatalogAvailabilityButton item={item} />
      )}
    </div>
  );
}
