import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { ValidatedTextField } from "../../forms/ValidatedTextField";
import { DiscrepancyOutcomeFields } from "./DiscrepancyOutcomeFields";
import { DiscrepancySubmit } from "./DiscrepancySubmit";
import type { DiscrepancyRecordState } from "./discrepancy-use-record";
import styles from "./transfers.module.css";

export function DiscrepancyResolveForm({ state }: { state: DiscrepancyRecordState }) {
  const { t } = useTranslation();
  const id = useId();
  const hint = t("discrepancies.close.reasonHint", { min: state.limits.minLength });
  return (
    <Card title={t("discrepancies.close.title")}>
      <fieldset
        disabled={state.command.isFrozen || !state.isFresh || !state.isOnline}
        className={styles.proof}
      >
        {state.record?.lines.map((line) => (
          <DiscrepancyOutcomeFields key={line.id} state={state} line={line} />
        ))}
        <ValidatedTextField
          id={id}
          label={t("discrepancies.close.reason")}
          value={state.draft.reason}
          maxLength={state.limits.maxLength}
          hint={hint}
          validate={(value) => (value.trim().length < state.limits.minLength ? hint : undefined)}
          onChange={(event) => {
            state.setReason(event.currentTarget.value);
          }}
        />
      </fieldset>
      <DiscrepancySubmit state={state} />
    </Card>
  );
}
