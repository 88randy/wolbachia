import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../shell/use-document-title";
import page from "../styles/page.module.css";
import { classNames } from "../styles/class-names";
import type { Motorcycle } from "./fleet-query";
import { FleetTabs } from "./FleetTabs";
import { FleetGap } from "./FleetGap";
import { FleetLoadError } from "./FleetLoadError";
import { MotorcycleSummary } from "./MotorcycleSummary";
import { MotorcycleStatusBadge } from "./MotorcycleStatusBadge";
import { MotorcycleActions } from "./MotorcycleActions";
import { useFleetTabs } from "./use-fleet-tabs";
import styles from "./fleet.module.css";
interface Props {
  motorcycle: Motorcycle;
  error: unknown;
  onRetry: () => void;
  isRefreshing: boolean;
}
export function MotorcycleScreen({ motorcycle, error, onRetry, isRefreshing }: Props) {
  const { t } = useTranslation();
  const tabs = useFleetTabs();
  useDocumentTitle(motorcycle.code);
  return (
    <section className={classNames(page.page, styles.content)}>
      <Link to="/fleet/motorcycles" search={tabs.listSearch}>
        {t("fleet.record.back")}
      </Link>
      <div className={styles.heading}>
        <h1 className={classNames(page.title, styles.code)}>{motorcycle.code}</h1>
        {error === null && !isRefreshing && <MotorcycleStatusBadge motorcycle={motorcycle} />}
      </div>
      {isRefreshing && <p role="status">{t("fleet.record.loading")}</p>}
      {error !== null && <FleetLoadError error={error} onRetry={onRetry} />}
      <MotorcycleActions motorcycle={motorcycle} isUnverified={error !== null || isRefreshing} />
      <FleetTabs code={motorcycle.code} />
      {tabs.tab === "summary" ? (
        <MotorcycleSummary motorcycle={motorcycle} />
      ) : (
        <FleetGap tab={tabs.tab} />
      )}
    </section>
  );
}
