import { Ban, Check, LockKeyhole } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CatalogItem } from "./catalogs-query";
import styles from "./catalogs.module.css";

/** Icon and localized text carry status without depending on color. */
export function CatalogStatus({ item }: { item: CatalogItem }) {
  const { t } = useTranslation();
  const Icon = item.is_other ? LockKeyhole : item.is_active ? Check : Ban;
  const key = item.is_other
    ? "catalogs.status.fixed"
    : item.is_active
      ? "catalogs.status.active"
      : "catalogs.status.inactive";
  return (
    <span className={styles.badge}>
      <Icon className={styles.icon} aria-hidden="true" />
      {t(key)}
    </span>
  );
}
