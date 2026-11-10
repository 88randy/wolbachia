/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { Link, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../shell/use-document-title";
import { PortalBrand } from "./PortalBrand";
import { PortalError, PortalLoading, PortalMissing } from "./PortalStates";
import { isPortalMissing, usePortalHome } from "./portal-data";

const NAV_LINK =
  "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-ink-2 no-underline hover:bg-tint hover:text-ink";
const NAV_ACTIVE = "bg-action text-on-action hover:bg-action hover:text-on-action";

/** Public layout of the portal: no sidebar, no login. Brand, three sections and a privacy note. */
export function PortalLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { orgSlug } = useParams({ strict: false });
  const slug = orgSlug ?? "";
  const home = usePortalHome(slug);
  useDocumentTitle(home.data?.organization.name ?? t("portal.brand"));
  const enabled = home.data?.enabled ?? [];
  return (
    <div className="flex min-h-screen flex-col bg-background text-ink">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        {t("shell.a11y.skipToContent")}
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <PortalBrand
            organizationName={home.data?.organization.name ?? ""}
            logoUrl={home.data?.organization.logoUrl ?? null}
          />
          {home.data && (
            <nav aria-label={t("portal.nav.label")} className="flex flex-wrap gap-1.5">
              <Link
                to="/portal/$orgSlug"
                params={{ orgSlug: slug }}
                activeOptions={{ exact: true }}
                className={NAV_LINK}
                activeProps={{ className: `${NAV_LINK} ${NAV_ACTIVE}`, "aria-current": "page" }}
              >
                {t("portal.nav.home")}
              </Link>
              {enabled.includes("releases_by_week") && (
                <Link
                  to="/portal/$orgSlug/trends"
                  params={{ orgSlug: slug }}
                  className={NAV_LINK}
                  activeProps={{ className: `${NAV_LINK} ${NAV_ACTIVE}`, "aria-current": "page" }}
                >
                  {t("portal.nav.trends")}
                </Link>
              )}
              {enabled.includes("coverage") && (
                <Link
                  to="/portal/$orgSlug/map"
                  params={{ orgSlug: slug }}
                  className={NAV_LINK}
                  activeProps={{ className: `${NAV_LINK} ${NAV_ACTIVE}`, "aria-current": "page" }}
                >
                  {t("portal.nav.map")}
                </Link>
              )}
            </nav>
          )}
        </div>
      </header>
      <main id="portal-main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {home.isPending && <PortalLoading />}
        {home.isError &&
          (isPortalMissing(home.error) ? (
            <PortalMissing />
          ) : (
            <PortalError
              onRetry={() => {
                void home.refetch();
              }}
            />
          ))}
        {home.data && children}
      </main>
      <footer className="border-t border-line bg-surface">
        <p className="mx-auto m-0 w-full max-w-6xl px-6 py-5 text-[13px] text-ink-2">
          {t("portal.footer.privacy")}
          {home.data
            ? ` ${t("portal.footer.source", { organization: home.data.organization.name })}`
            : ""}
        </p>
      </footer>
    </div>
  );
}
