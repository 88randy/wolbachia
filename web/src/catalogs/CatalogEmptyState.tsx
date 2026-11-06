import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { CatalogRefreshNotice } from "./CatalogRefreshNotice";
import page from "../styles/page.module.css";
interface Props {
  error: Error | null;
  onRetry: () => Promise<unknown>;
}
/** No catalog-creation API exists here; retry remains the available next action. */
export function CatalogEmptyState({ error, onRetry }: Props) {
  const { t } = useTranslation();
  return (
    <section className={page.page}>
      <Card title={t("catalogs.page.title")} headingLevel={1}>
        <EmptyState
          kind="noData"
          message={t("catalogs.page.empty")}
          actionLabel={t("common.actions.retry")}
          onAction={
            error === null
              ? () => {
                  void onRetry();
                }
              : undefined
          }
        />
        <CatalogRefreshNotice error={error} onRetry={onRetry} />
      </Card>
    </section>
  );
}
