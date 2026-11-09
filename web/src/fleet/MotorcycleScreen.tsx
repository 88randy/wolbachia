import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../shell/use-document-title";
import page from "../styles/page.module.css";
import { classNames } from "../styles/class-names";
import type { MotorcycleDetail } from "./fleet-query";
import type { FleetRecordScope } from "./use-fleet-scope";
import { FleetTabs } from "./FleetTabs";
import { FleetHistory } from "./FleetHistory";
import { canFleetAction } from "./use-fleet-scope";
import type { useFleetOperations } from "./use-fleet-operations";
import { FleetRecordOperations } from "./FleetRecordOperations";
import { MotorcycleSummary } from "./MotorcycleSummary";
import { MotorcycleRecordHeader } from "./MotorcycleRecordHeader";
import { useFleetTabs } from "./use-fleet-tabs";
import styles from "./fleet.module.css";
interface Props {
  motorcycle: MotorcycleDetail;
  scope: FleetRecordScope;
  operations: ReturnType<typeof useFleetOperations>;
  error: unknown;
  onRetry: () => void;
  isRefreshing: boolean;
}
function historyActions(props: Props) {
  return {
    scope: props.scope,
    canManage: canFleetAction(props.scope, props.motorcycle.center, "motorcycle.manage"),
    canClear:
      canFleetAction(props.scope, props.motorcycle.center, "motorcycle.service_clear") &&
      canFleetAction(props.scope, props.motorcycle.center, "field.upload"),
    isUnverified: props.isRefreshing || props.error !== null || !!props.motorcycle.voided_at,
    onClear: props.operations.openClear,
  };
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
      <FleetRecordOperations
        motorcycle={props.motorcycle}
        scope={props.scope}
        operations={props.operations}
      />
      <FleetTabs code={props.motorcycle.code} />
      {tabs.tab === "summary" ? (
        <MotorcycleSummary motorcycle={props.motorcycle} />
      ) : (
        <FleetHistory
          key={`${props.scope.context}|${props.motorcycle.id}|${tabs.tab}`}
          motorcycle={props.motorcycle.id}
          tab={tabs.tab}
          actions={historyActions(props)}
        />
      )}
    </section>
  );
}
