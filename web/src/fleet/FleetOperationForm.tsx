import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { FleetOperationFeedback } from "./FleetOperationFeedback";
import type { FleetDraft } from "./fleet-drafts";
import type { useFleetOperations } from "./use-fleet-operations";
import styles from "./fleet.module.css";
export interface FleetOperationProps {
  draft: FleetDraft;
  operations: ReturnType<typeof useFleetOperations>;
}
export function fleetInputsBlocked({ draft, operations }: FleetOperationProps) {
  return draft.phase !== "idle" || operations.isUnverified || draft.failure === "uncertain";
}
function isBlocked({ draft, operations }: FleetOperationProps) {
  return (
    draft.phase !== "idle" ||
    operations.isUnverified ||
    operations.cooling ||
    operations.requiresReview ||
    draft.failure === "uncertain" ||
    draft.failure === "conflict"
  );
}
function FleetOperationFooter(props: FleetOperationProps & { verified: boolean }) {
  const { t } = useTranslation();
  const busy = props.draft.phase !== "idle";
  const label = props.draft.kind === "clear" ? "fleet.action.clearFault" : "fleet.action.service";
  return (
    <div className={styles.actions}>
      <Button
        data-fleet-cancel
        variant="secondary"
        aria-disabled={busy}
        onClick={props.operations.close}
      >
        {t("common.actions.cancel")}
      </Button>
      <Button type="submit" loading={busy} aria-disabled={isBlocked(props) || !props.verified}>
        {t(busy ? "fleet.action.busy" : label)}
      </Button>
    </div>
  );
}
/** The two writes share the same native form/footer and guarded manual submission. */
export function FleetOperationForm(
  props: FleetOperationProps & { children: ReactNode; verified?: boolean },
) {
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void props.operations.submit();
      }}
    >
      <FleetOperationFeedback draft={props.draft} operations={props.operations} />
      {props.children}
      <FleetOperationFooter
        draft={props.draft}
        operations={props.operations}
        verified={props.verified ?? true}
      />
    </form>
  );
}
