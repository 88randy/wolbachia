import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../shell/use-document-title";
import page from "../styles/page.module.css";
import { classNames } from "../styles/class-names";
import type { Motorcycle } from "./fleet-query";
import { FleetTabs } from "./FleetTabs";
import { FleetGap } from "./FleetGap";
import { MotorcycleSummary } from "./MotorcycleSummary";
import { MotorcycleRecordHeader } from "./MotorcycleRecordHeader";
import { useFleetTabs } from "./use-fleet-tabs";
import styles from "./fleet.module.css";
interface Props {
  motorcycle: Motorcycle;
  error: unknown;
  onRetry: () => void;
  isRefreshing: boolean;
}
export function MotorcycleScreen(props: Props) {
  const { t } = useTranslation();
  const tabs = useFleetTabs();
  useDocumentTitle(props.motorcycle.code);
  return (
    <section className={classNames(page.page, styles.content)}>
      <Link to="/fleet/motorcycles" search={tabs.listSearch}>
        {t("fleet.record.back")}
      </Link>
      <MotorcycleRecordHeader {...props} />
      <FleetTabs code={props.motorcycle.code} />
      {tabs.tab === "summary" ? (
        <MotorcycleSummary motorcycle={props.motorcycle} />
      ) : (
        <FleetGap tab={tabs.tab} />
      )}
    </section>
  );
}
