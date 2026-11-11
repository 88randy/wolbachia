import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Card } from "../../ui/Card";
import { InlineNotice } from "../../ui/InlineNotice";
import { AssignmentActions } from "./AssignmentActions";
import { AssignmentDelivery } from "./AssignmentDelivery";
import { CommandFeedback } from "./CommandFeedback";
import { DeliveryTable } from "./DeliveryTable";
import { SignatureStatus } from "./SignatureStatus";
import { SuggestionNotice } from "./SuggestionNotice";
import { compareDelivery } from "./delivery-compare";
import { useAssignmentPanel } from "./use-assignment-panel";
import type { AssignmentPanelState } from "./use-assignment-panel";
import type { AllocationScope } from "./allocation-query";

function FormBody({ panel, canAllocate }: { panel: AssignmentPanelState; canAllocate: boolean }) {
  const { t } = useTranslation();
  if (panel.saved)
    return (
      <p className="m-0">{t("allocation.assignment.saved", { revision: panel.saved.revision })}</p>
    );
  if (!canAllocate)
    return <InlineNotice tone="info">{t("allocation.assignment.noPermission")}</InlineNotice>;
  return (
    <AssignmentDelivery
      draft={panel.draft}
      lots={panel.lots.data}
      origins={panel.origins.data ?? []}
    />
  );
}

function Summary({ panel }: { panel: AssignmentPanelState }) {
  const { t } = useTranslation();
  const rows = compareDelivery(panel.suggestion.data, panel.draft.lines);
  return (
    <Card title={t("allocation.assignment.summaryTitle")} headingLevel={2}>
      <div className="flex min-w-0 flex-col gap-4" aria-busy={panel.suggestion.isFetching}>
        <SuggestionNotice suggestion={panel.suggestion} />
        {rows.length > 0 ? (
          <DeliveryTable rows={rows} lots={panel.lots.data} />
        ) : (
          <p className="m-0 text-sm text-ink-2">{t("allocation.assignment.summaryEmpty")}</p>
        )}
        <SignatureStatus state={panel.signature} />
      </div>
    </Card>
  );
}

/** W15 work area of one courier and day: the delivery form on the left, the summary on the right. */
export function AssignmentPanel(props: {
  scope: AllocationScope;
  courier: Schemas["OperationalPersonnel"];
  date: string;
  canAllocate: boolean;
}) {
  const { t } = useTranslation();
  const panel = useAssignmentPanel(props.scope, props.courier.id, props.date);
  const title = t("allocation.assignment.panelTitle", { name: props.courier.display_name });
  const isCreated = panel.command.result?.kind === "assign";
  const success = isCreated ? "allocation.assignment.created" : "allocation.assignment.released";
  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <Card title={title} headingLevel={2}>
        <div className="flex min-w-0 flex-col gap-4">
          <FormBody panel={panel} canAllocate={props.canAllocate} />
          <CommandFeedback command={panel.command} successKey={success} />
          {props.canAllocate && <AssignmentActions panel={panel} />}
        </div>
      </Card>
      <Summary panel={panel} />
    </div>
  );
}
