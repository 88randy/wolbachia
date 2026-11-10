import { DetailPage } from "../components/templates/DetailPage";
import type { MotorcycleDetail } from "./fleet-query";
import type { FleetRecordScope } from "./use-fleet-scope";
import { FleetTabs } from "./FleetTabs";
import { FleetHistory } from "./FleetHistory";
import { canFleetAction } from "./use-fleet-scope";
import type { useFleetOperations } from "./use-fleet-operations";
import { FleetRecordOperations } from "./FleetRecordOperations";
import { MotorcycleSummary } from "./MotorcycleSummary";
import { MotorcycleHeaderActions, MotorcycleNotices } from "./MotorcycleRecordHeader";
import { MotorcycleStatusBadge } from "./MotorcycleStatusBadge";
import { useFleetTabs } from "./use-fleet-tabs";
import type { FleetTab } from "./use-fleet-tabs";

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
function MotorcycleBody({ screen, tab }: { screen: Props; tab: FleetTab }) {
  if (tab === "summary") return <MotorcycleSummary motorcycle={screen.motorcycle} />;
  return (
    <FleetHistory
      key={`${screen.scope.context}|${screen.motorcycle.id}|${tab}`}
      motorcycle={screen.motorcycle.id}
      tab={tab}
      actions={historyActions(screen)}
    />
  );
}
/** W21: the motorcycle detail page. Tabs live in the URL; every history tab is a server table. */
export function MotorcycleScreen(props: Props) {
  const tabs = useFleetTabs();
  const { motorcycle, error, isRefreshing } = props;
  return (
    <DetailPage
      code={motorcycle.plate || undefined}
      title={motorcycle.code}
      status={
        error === null && !isRefreshing ? (
          <MotorcycleStatusBadge motorcycle={motorcycle} compact />
        ) : undefined
      }
      actions={
        <>
          <MotorcycleHeaderActions {...props} listSearch={tabs.listSearch} />
          <FleetRecordOperations
            motorcycle={motorcycle}
            scope={props.scope}
            operations={props.operations}
          />
        </>
      }
      notices={<MotorcycleNotices {...props} />}
    >
      <FleetTabs code={motorcycle.code} />
      <MotorcycleBody screen={props} tab={tabs.tab} />
    </DetailPage>
  );
}
