import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import { SelectMenu } from "../ui/SelectMenu";
import type { Catalog } from "./catalogs-query";
import { displayLabel } from "./catalog-domain";

/** Catalog picker: one compact dropdown instead of a tab row that wraps over several lines. */
export function CatalogTabs({ catalogs, slug }: { catalogs: readonly Catalog[]; slug: string }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  return (
    <div className="flex max-w-md flex-col gap-1.5">
      <label htmlFor="catalog-picker" className="text-xs font-bold text-ink">
        {t("catalogs.page.tabs")}
      </label>
      <SelectMenu
        id="catalog-picker"
        value={slug}
        options={catalogs.map((catalog) => ({
          value: catalog.slug,
          label: displayLabel(catalog, language).label,
        }))}
        onValueChange={(next) => {
          void navigate({
            to: "/settings/catalogs/$slug",
            params: { slug: next },
            search: (previous: Record<string, unknown>) =>
              Object.fromEntries(
                Object.entries(previous).flatMap(([key, value]) =>
                  key.startsWith("catalog_") && typeof value === "string"
                    ? [[key, value] as const]
                    : [],
                ),
              ),
          });
        }}
      />
    </div>
  );
}
