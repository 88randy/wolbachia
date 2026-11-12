import { useTranslation } from "react-i18next";
import { DetailPage } from "../components/templates/DetailPage";
import { PrintLabelLink } from "../labels/PrintLabelLink";
import { Button } from "../ui/Button";
import type { MotorcycleDetail } from "./fleet-query";
import type { FleetRecordScope } from "./use-fleet-scope";
import { FleetTabs } from "./FleetTabs";
import { FleetHistory } from "./FleetHistory";
import { canFleetAction } from "./use-fleet-scope";
import type { useFleetOperations } from "./use-fleet-operations";
import { FleetRecordOperations } from "./FleetRecordOperations";
import { MotorcycleSummary } from "./MotorcycleSummary";
import { MotorcycleNotices } from "./MotorcycleRecordHeader";
import { MotorcycleActionDialogs } from "./MotorcycleActions";
import { MotorcycleStatusBadge } from "./MotorcycleStatusBadge";
import { useFleetTabs } from "./use-fleet-tabs";
import type { FleetTab } from "./use-fleet-tabs";
import { useMotorcycleActions } from "./use-motorcycle-actions";
import { useMotorcycleMenu } from "./use-motorcycle-menu";

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
/** The one primary action of the header; blocked, it says why on hover and to screen readers. */
function ServiceAction({ operations }: Pick<Props, "operations">) {
  const { t } = useTranslation();
  return (
    <Button
      aria-disabled={operations.isUnverified}
      title={operations.isUnverified ? t("fleet.action.blocked") : undefined}
      onClick={operations.openService}
    >
      {t("fleet.action.service")}
    </Button>
  );
}
function useBackLink(search: Record<string, string>) {
  const { t } = useTranslation();
  return { label: t("fleet.record.back"), link: { to: "/fleet/motorcycles", search } } as const;
}
/** Header actions: a link to print the label (not for voided ones) and, with permission, a service. */
function HeaderActions({ screen }: { screen: Props }) {
  const { motorcycle, scope, operations } = screen;
  return (
    <>
      {motorcycle.voided_at === null && <PrintLabelLink kind="motorcycle" code={motorcycle.code} />}
      {canFleetAction(scope, motorcycle.center, "motorcycle.manage") && (
        <ServiceAction operations={operations} />
      )}
    </>
  );
}
/** W21: the motorcycle detail page. Tabs live in the URL; every history tab is a server table. */
export function MotorcycleScreen(props: Props) {
  const tabs = useFleetTabs();
  const back = useBackLink(tabs.listSearch);
  const { motorcycle, error, isRefreshing, operations, scope } = props;
  const actions = useMotorcycleActions(motorcycle, error !== null || isRefreshing);
  const menu = useMotorcycleMenu(actions, props.onRetry);
  const isVerified = error === null && !isRefreshing;
  return (
    <DetailPage
      code={motorcycle.plate || undefined}
      centerId={motorcycle.center}
      title={motorcycle.code}
      back={back}
      status={isVerified ? <MotorcycleStatusBadge motorcycle={motorcycle} compact /> : undefined}
      actions={<HeaderActions screen={props} />}
      moreActions={menu}
      notices={<MotorcycleNotices {...props} />}
    >
      <FleetTabs code={motorcycle.code} />
      <MotorcycleBody screen={props} tab={tabs.tab} />
      <MotorcycleActionDialogs motorcycle={motorcycle} actions={actions} />
      <FleetRecordOperations scope={scope} operations={operations} />
    </DetailPage>
  );
}
