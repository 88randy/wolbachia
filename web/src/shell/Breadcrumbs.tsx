import { BreadcrumbItem } from "./BreadcrumbItem";
import { useCompactViewport } from "../ui/use-compact-viewport";
import { useMe } from "../session/use-me";
import { AREAS } from "../router/areas";
import { canOpenArea } from "../router/area-access";
import { useLocation, useRouter } from "@tanstack/react-router";
import "../router/crumb";
import { useTranslation } from "react-i18next";
import { breadcrumbsOf } from "./breadcrumb-path";
import styles from "./breadcrumbs.module.css";
import type { MessageKey } from "@wolbachia/i18n";
/** Shell-owned navigation remains mounted as only the page content changes. */
export function Breadcrumbs() {
  const { t } = useTranslation();
  const isCompact = useCompactViewport();
  const pathname = useLocation().pathname;
  const me = useMe();
  const area = AREAS.find((entry) => entry.path === `/${pathname.split("/")[1] ?? ""}`);
  const router = useRouter();
  const routes: Record<string, { options: { staticData?: { crumb?: MessageKey } } }> =
    router.routesByPath;
  const entries = breadcrumbsOf(pathname, {
    crumbOf: (path) => routes[path]?.options.staticData?.crumb,
    isRoute: (path) => path in routes,
  });
  if (entries.length === 0 || (area && !canOpenArea(me, area))) return null;
  return (
    <nav
      className={styles.nav}
      data-compact={isCompact}
      aria-label={t("refresh.navigation.breadcrumbs")}
    >
      <ol>
        {entries.map((entry) => (
          <BreadcrumbItem key={entry.path} entry={entry} />
        ))}
      </ol>
    </nav>
  );
}
