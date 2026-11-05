import { CatalogRefreshNotice } from "./CatalogRefreshNotice";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";

import { useDocumentTitle } from "../shell/use-document-title";
import { NotFoundState } from "../states/NotFoundState";
import { catalogsQueryOptions } from "./catalogs-query";

import { CatalogItems } from "./CatalogItems";
import { CatalogTabs } from "./CatalogTabs";
import page from "../styles/page.module.css";

/** W63: API-defined tabs, first-catalog redirect, and a slug scoped editor. */
export function CatalogsPage() {
  const { t } = useTranslation();
  const client = useApiClient();
  const { slug } = useParams({ strict: false });
  const query = useQuery(catalogsQueryOptions(client));
  useDocumentTitle(t("catalogs.page.title"));
  if (query.error && query.data === undefined) throw query.error;
  if (!query.data) return <p role="status">{t("catalogs.page.loading")}</p>;
  const first = query.data[0];
  if (!first)
    return (
      <section className={page.page}>
        <h1>{t("catalogs.page.title")}</h1>
        <p>{t("catalogs.page.empty")}</p>
        <CatalogRefreshNotice error={query.error} onRetry={query.refetch} />
      </section>
    );
  if (!slug)
    return <Navigate to="/settings/catalogs/$slug" params={{ slug: first.slug }} replace />;
  const catalog = query.data.find((entry) => entry.slug === slug);
  if (!catalog) return <NotFoundState />;
  return (
    <section className={page.page}>
      <h1 className={page.title}>{t("catalogs.page.title")}</h1>
      <CatalogRefreshNotice error={query.error} onRetry={query.refetch} />
      <CatalogTabs catalogs={query.data} slug={slug} />
      <CatalogItems key={slug} catalog={catalog} />
    </section>
  );
}
