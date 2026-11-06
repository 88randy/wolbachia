import { useTranslation } from "react-i18next";
import { useFormatDate } from "../format/use-formatters";
import { StatusPill } from "../ui/StatusPill";
import type { CatalogItem } from "./catalogs-query";
import styles from "./catalogs.module.css";
/** Shared icon/text pills preserve fixed, active and deactivated meanings. */
export function CatalogStatus({ item }: { item: CatalogItem }) {
  const { t } = useTranslation();
  const formatDate = useFormatDate();
  const key = item.is_other
    ? "catalogs.status.fixed"
    : item.is_active
      ? "catalogs.status.active"
      : "catalogs.status.inactive";
  return (
    <div className={styles.actions}>
      <StatusPill tone={item.is_active && !item.is_other ? "success" : "neutral"}>
        {t(key)}
      </StatusPill>
      {!item.is_active && item.deactivated_at && (
        <span className={styles.timestamp}>
          {formatDate(item.deactivated_at)} ·{" "}
          {item.deactivated_by_username ?? t("catalogs.table.unknownAuthor")}
        </span>
      )}
    </div>
  );
}
