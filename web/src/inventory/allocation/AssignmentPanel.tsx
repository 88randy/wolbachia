import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { SignaturePad } from "../../ui/SignaturePad";
import { Card } from "../../ui/Card";
import { InlineNotice } from "../../ui/InlineNotice";
import { AssignmentActions } from "./AssignmentActions";
import { AssignmentDelivery } from "./AssignmentDelivery";
import { CommandFeedback } from "./CommandFeedback";
import { DeliveryStatusPill } from "./DeliveryStatusPill";
import { DeliveryTable } from "./DeliveryTable";
import { DeliveryTimeline } from "./DeliveryTimeline";
import { SignatureStatus } from "./SignatureStatus";
import { SuggestionNotice } from "./SuggestionNotice";
import { compareDelivery } from "./delivery-compare";
import { useAssignmentPanel } from "./use-assignment-panel";
import type { AssignmentPanelState } from "./use-assignment-panel";
import type { AllocationScope } from "./allocation-query";
import type { CourierEntry } from "./allocation-query";

const NOTES: Partial<Record<NonNullable<AssignmentPanelState["status"]>, MessageKey>> = {
  cancelled: "allocation.delivery.cancelledNote",
  released: "allocation.delivery.releasedNote",
  received: "allocation.delivery.receivedNote",
};

function FormBody(props: {
  panel: AssignmentPanelState;
  canAllocate: boolean;
  courierName: string;
}) {
  const { t } = useTranslation();
  const { panel, canAllocate } = props;
  const note = panel.status ? NOTES[panel.status] : undefined;
  if (!canAllocate)
    return <InlineNotice tone="info">{t("allocation.assignment.noPermission")}</InlineNotice>;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {note && <InlineNotice tone="info">{t(note)}</InlineNotice>}
      {panel.saved && panel.isEditable && panel.mode === "phone" && (
        <InlineNotice tone="info">{t("allocation.delivery.phoneMode")}</InlineNotice>
      )}
      {panel.saved &&
        panel.status === "released" &&
        panel.saved.lifecycle?.signature?.state === "pending_phone" && (
          <InlineNotice tone="warning">{t("allocation.delivery.pendingPhone")}</InlineNotice>
        )}
      {panel.isEditable && (
        <AssignmentDelivery
          draft={panel.draft}
          lots={panel.lots.data}
          origins={panel.origins.data ?? []}
          isOriginFixed={panel.saved !== null}
        />
      )}
      {panel.saved && panel.isEditable && panel.mode !== "phone" && (
        <SignaturePad
          id="signature-pad"
          label={t("ui.signaturePad.signer", { name: props.courierName })}
          disabled={panel.command.isBusy}
          isReady={panel.signatureBlob !== null}
          onChange={panel.setSignatureBlob}
        />
      )}
    </div>
  );
}

function Summary({ panel }: { panel: AssignmentPanelState }) {
  const { t } = useTranslation();
  const rows = compareDelivery(
    panel.suggestion.data,
    panel.saved && !panel.isEditable
      ? panel.saved.lines.map((line) => ({
          key: line.id,
          lotId: line.lot_id,
          lotCode: "",
          supplyVersionId: line.unit_version_id,
          quantity: line.quantity,
        }))
      : panel.draft.lines,
  );
  return (
    <div className="flex min-w-0 flex-col gap-5">
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
      {panel.saved && (
        <Card title={t("allocation.delivery.historyTitle")} headingLevel={2}>
          <DeliveryTimeline assignment={panel.saved} />
        </Card>
      )}
    </div>
  );
}

/** W15 work area of one courier and day: the delivery on the left, its summary and history right. */
export function AssignmentPanel(props: {
  scope: AllocationScope;
  courier: CourierEntry;
  date: string;
  canAllocate: boolean;
}) {
  const { t } = useTranslation();
  const panel = useAssignmentPanel(props.scope, props.courier.id, props.date);
  const title = t("allocation.assignment.panelTitle", { name: props.courier.display_name });
  const kind = panel.command.result?.kind;
  const success =
    kind === "release"
      ? "allocation.assignment.released"
      : kind === "revise"
        ? "allocation.delivery.revised"
        : "allocation.assignment.created";
  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <Card
        title={title}
        headingLevel={2}
        actions={panel.status ? <DeliveryStatusPill status={panel.status} /> : undefined}
      >
        <div className="flex min-w-0 flex-col gap-4">
          <FormBody
            panel={panel}
            canAllocate={props.canAllocate}
            courierName={props.courier.display_name}
          />
          <CommandFeedback command={panel.command} successKey={success} />
          {props.canAllocate && (
            <AssignmentActions panel={panel} courierName={props.courier.display_name} />
          )}
        </div>
      </Card>
      <Summary panel={panel} />
    </div>
  );
}
