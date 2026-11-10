import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DetailPage } from "../components/templates/DetailPage";
import type { MotorcycleDetail } from "./fleet-query";
import type { FleetRecordScope } from "./use-fleet-scope";
import { FleetTabs } from "./FleetTabs";
import { FleetHistory } from "./FleetHistory";
import { canFleetAction } from "./use-fleet-scope";
import type { useFleetOperations } from "./use-fleet-operations";
import { FleetRecordOperations } from "./FleetRecordOperations";
import { FleetRecordFeedback } from "./FleetRecordFeedback";
import { MotorcycleActions } from "./MotorcycleActions";
import { MotorcycleStatusBadge } from "./MotorcycleStatusBadge";
import { MotorcycleSummary } from "./MotorcycleSummary";
import { blockedReasonKey } from "./motorcycle-status";
import { useFleetTabs } from "./use-fleet-tabs";
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
/** W21: header with status and actions, tabs, then card sections. */
export function MotorcycleScreen(props: Props) {
  const { t } = useTranslation();
  const tabs = useFleetTabs();
  const { motorcycle } = props;
  const isVerified = props.error === null && !props.isRefreshing;
  const subtitle = [motorcycle.plate, motorcycle.is_blocked ? t(blockedReasonKey(motorcycle)) : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <DetailPage
      title={motorcycle.code}
      status={isVerified ? <MotorcycleStatusBadge motorcycle={motorcycle} compact /> : undefined}
      subtitle={subtitle || undefined}
      back={{
        label: t("fleet.record.back"),
        link: { to: "/fleet/motorcycles", search: tabs.listSearch },
      }}
      actions={
        <>
          <FleetRecordOperations
            motorcycle={motorcycle}
            scope={props.scope}
            operations={props.operations}
          />
          <MotorcycleActions motorcycle={motorcycle} isUnverified={!isVerified} />
        </>
      }
      moreActions={[
        {
          id: "refresh",
          label: t("fleet.action.refresh"),
          icon: <RefreshCw aria-hidden="true" className="size-4" />,
          onSelect: props.onRetry,
          disabled: props.isRefreshing,
        },
      ]}
      notices={
        <FleetRecordFeedback
          error={props.error}
          onRetry={props.onRetry}
          isRefreshing={props.isRefreshing}
        />
      }
    >
      <FleetTabs code={motorcycle.code} />
      {tabs.tab === "summary" ? (
        <MotorcycleSummary motorcycle={motorcycle} />
      ) : (
        <FleetHistory
          key={`${props.scope.context}|${motorcycle.id}|${tabs.tab}`}
          motorcycle={motorcycle.id}
          tab={tabs.tab}
          actions={historyActions(props)}
        />
      )}
    </DetailPage>
  );
}
