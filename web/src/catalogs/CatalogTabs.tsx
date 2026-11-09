import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import type { Catalog } from "./catalogs-query";
import { displayLabel } from "./catalog-domain";
import styles from "./catalogs.module.css";

/** Links with aria-current, rather than ARIA tabs with a different keyboard contract. */
export function CatalogTabs({ catalogs, slug }: { catalogs: readonly Catalog[]; slug: string }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  return (
    <nav className={styles.tabs} aria-label={t("catalogs.page.tabs")}>
      {catalogs.map((catalog) => (
        <Link
          key={catalog.slug}
          to="/settings/catalogs/$slug"
          params={{ slug: catalog.slug }}
          search={(previous) =>
            Object.fromEntries(
              Object.entries(previous).flatMap(([key, value]) =>
                key.startsWith("catalog_") && typeof value === "string"
                  ? [[key, value] as const]
                  : [],
              ),
            )
          }
          aria-current={slug === catalog.slug ? "page" : undefined}
          className={styles.tab}
        >
          {displayLabel(catalog, language).label}
        </Link>
      ))}
    </nav>
  );
}
