import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Card } from "../../ui/Card";
import { InlineNotice } from "../../ui/InlineNotice";
import { AssignmentActions } from "./AssignmentActions";
import { AssignmentDelivery } from "./AssignmentDelivery";
import { CommandFeedback } from "./CommandFeedback";
import { SignatureStatus } from "./SignatureStatus";
import { SuggestionNotice } from "./SuggestionNotice";
import { useAssignmentPanel } from "./use-assignment-panel";
import type { AssignmentPanelState } from "./use-assignment-panel";
import type { AllocationScope } from "./allocation-query";
import styles from "../inventory.module.css";

function Body({ panel, canAllocate }: { panel: AssignmentPanelState; canAllocate: boolean }) {
  const { t } = useTranslation();
  if (panel.saved)
    return <p>{t("allocation.assignment.saved", { revision: panel.saved.revision })}</p>;
  if (!canAllocate)
    return <InlineNotice tone="info">{t("allocation.assignment.noPermission")}</InlineNotice>;
  return (
    <AssignmentDelivery
      draft={panel.draft}
      suggestion={panel.suggestion.data}
      lots={panel.lots.data}
      origins={panel.origins.data ?? []}
    />
  );
}

/** W15 work area of one courier and day: suggestion, delivery scans and the signature status. */
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
    <Card title={title} headingLevel={2}>
      <div className={styles.form} aria-busy={panel.suggestion.isFetching}>
        <SuggestionNotice suggestion={panel.suggestion} />
        <Body panel={panel} canAllocate={props.canAllocate} />
        <SignatureStatus state={panel.signature} />
        {props.canAllocate && <AssignmentActions panel={panel} />}
        <CommandFeedback command={panel.command} successKey={success} />
      </div>
    </Card>
  );
}
