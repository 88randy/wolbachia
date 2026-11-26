import { CatalogLoadingState } from "./CatalogLoadingState";
import { CatalogEmptyState } from "./CatalogEmptyState";
import { CatalogRefreshNotice } from "./CatalogRefreshNotice";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";

import { useDocumentTitle } from "../shell/use-document-title";
import { useBreadcrumbLabel } from "../shell/breadcrumb-labels";
import { useLanguage } from "../i18n/use-language";
import { displayLabel } from "./catalog-domain";
import { NotFoundState } from "../states/NotFoundState";
import { catalogEditorKey, catalogsQueryOptions } from "./catalogs-query";
import { useSessionIdentity } from "../session/use-session-identity";

import { CatalogItems } from "./CatalogItems";
import { CatalogNavigation } from "./CatalogNavigation";
import { useCatalogRefresh } from "./use-catalog-refresh";
import page from "../styles/page.module.css";

/** W63: API-defined tabs, first-catalog redirect, and an identity- and slug-scoped editor. */
export function CatalogsPage() {
  const { t } = useTranslation();
  const { slug } = useParams({ strict: false });
  const scope = { client: useApiClient(), identity: useSessionIdentity() };
  const query = useQuery(catalogsQueryOptions(scope));
  const refresh = useCatalogRefresh();
  const { language } = useLanguage();
  useDocumentTitle(t("catalogs.page.title"));
  const current = query.data?.find((entry) => entry.slug === slug);
  useBreadcrumbLabel(
    `/settings/catalogs/${slug ?? ""}`,
    current ? displayLabel(current, language).label : undefined,
  );
  if (query.error && query.data === undefined) throw query.error;
  if (!query.data) return <CatalogLoadingState />;
  const first = query.data[0];
  if (!first) return <CatalogEmptyState error={query.error} onRetry={query.refetch} />;
  if (!slug)
    return <Navigate to="/settings/catalogs/$slug" params={{ slug: first.slug }} replace />;
  const catalog = query.data.find((entry) => entry.slug === slug);
  if (!catalog) return <NotFoundState />;
  return (
    <section className={page.page}>
      <h1 className={page.title}>{t("catalogs.page.title")}</h1>
      <CatalogRefreshNotice error={query.error} onRetry={refresh} />
      <CatalogNavigation slug={slug} isParentError={query.error !== null} />
      <CatalogItems key={catalogEditorKey(scope.identity, "tabs")} catalog={catalog} />
    </section>
  );
}
