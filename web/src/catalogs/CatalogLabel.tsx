import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import { displayLabel } from "./catalog-domain";
import type { CatalogItem } from "./catalogs-query";
import styles from "./catalogs.module.css";

/** The row warns in English when it is showing Spanish API data. */
export function CatalogLabel({ item }: { item: CatalogItem }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { label, isMissingEnglish } = displayLabel(item, language);
  return (
    <>
      <span className={item.is_active ? undefined : styles.struck}>{label}</span>
      {isMissingEnglish && <span className={styles.warning}>{t("catalogs.form.warning")}</span>}
    </>
  );
}
