import { useTranslation } from "react-i18next";
import { useFormatNumber } from "../format/use-formatters";
import type { CatalogItem } from "./catalogs-query";

/** The count includes historical records; their drill-down routes are outside W63's scope. */
export function CatalogUsage({ item }: { item: CatalogItem }) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  return (
    <span aria-description={t("catalogs.status.inUseDescription")}>
      {formatNumber(item.usage_count)}
    </span>
  );
}
