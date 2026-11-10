import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { CommandFeedback } from "./CommandFeedback";
import { ReasonFields } from "./ReasonFields";
import { useJustify } from "./use-justify";
import type { AllocationScope } from "./allocation-query";
import type { ReconciliationRow } from "./reconciliation-equation";
import styles from "../inventory.module.css";

function Actions({
  state,
  blockedId,
  onClose,
}: {
  state: ReturnType<typeof useJustify>;
  blockedId: string | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.actions}>
      <Button
        type="submit"
        loading={state.command.isBusy}
        aria-disabled={state.blocker !== null || undefined}
        aria-describedby={blockedId}
      >
        {t("allocation.reconciliation.justifySubmit")}
      </Button>
      <Button variant="tertiary" onClick={onClose}>
        {t("allocation.command.close")}
      </Button>
    </div>
  );
}

export function JustifyPanel(props: {
  scope: AllocationScope;
  row: ReconciliationRow;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const state = useJustify(props.scope, props.row);
  const blockedId = state.blocker === null ? undefined : `${titleId}-blocked`;
  return (
    <Card title={t("allocation.reconciliation.justifyTitle")} titleId={titleId} headingLevel={2}>
      <form
        className={styles.form}
        aria-labelledby={titleId}
        onSubmit={(event) => {
          event.preventDefault();
          state.submit();
        }}
      >
        <ReasonFields fields={state.reason} />
        {state.blocker !== null && <p id={blockedId}>{t(state.blocker)}</p>}
        <Actions state={state} blockedId={blockedId} onClose={props.onClose} />
        <CommandFeedback command={state.command} successKey="allocation.reconciliation.justified" />
      </form>
    </Card>
  );
}
