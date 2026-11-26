import { useId } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Select } from "../../forms/Select";
import { useQuantityText } from "../use-quantity-text";
import { DiscrepancyOutcomeEvidence } from "./DiscrepancyOutcomeEvidence";
import type { DiscrepancyRecordState } from "./discrepancy-use-record";
import type { DiscrepancyOutcomeDraft } from "./discrepancy-resolution";
import { discrepancyKindKeys, discrepancyOutcomeKeys } from "./discrepancy-labels";

interface OutcomeProps {
  state: DiscrepancyRecordState;
  line: Schemas["DiscrepancyLine"];
}
function selectedOutcome(event: ChangeEvent<HTMLSelectElement>): DiscrepancyOutcomeDraft {
  return { kind: event.currentTarget.value as DiscrepancyOutcomeDraft["kind"] };
}
function updateOutcome(state: DiscrepancyRecordState, lineId: string) {
  return (event: ChangeEvent<HTMLSelectElement>) => {
    state.setOutcome(lineId, selectedOutcome(event));
  };
}
function useOutcomeOptions(state: DiscrepancyRecordState, line: Schemas["DiscrepancyLine"]) {
  const { t } = useTranslation();
  const permissions = state.scope.identity.permissions ?? [];
  const kinds: DiscrepancyOutcomeDraft["kind"][] = [""];
  if (line.kind === "missing") kinds.push("ack_missing");
  if (line.kind === "missing" && permissions.includes("transfer.receive"))
    kinds.push("recover_dest", "return_origin");
  if (permissions.includes("transfer.read")) kinds.push("reference_signed_correction");
  return kinds.map((value) => ({
    value,
    label: t(value ? discrepancyOutcomeKeys[value] : "discrepancies.outcome.choose"),
  }));
}
export function DiscrepancyOutcomeFields({ state, line }: OutcomeProps) {
  const { t } = useTranslation();
  const quantityText = useQuantityText();
  const id = useId();
  const options = useOutcomeOptions(state, line);
  const draft = state.draft.outcomes[line.id] ?? { kind: "" };
  return (
    <section>
      <p>
        {t(discrepancyKindKeys[line.kind])} · {quantityText(line.quantity)}
      </p>
      <Select
        id={id}
        label={t("discrepancies.close.outcome")}
        options={options}
        value={draft.kind}
        onChange={updateOutcome(state, line.id)}
      />
      <DiscrepancyOutcomeEvidence state={state} line={line} />
      {options.length === 1 && <p>{t("discrepancies.close.correctionPermission")}</p>}
    </section>
  );
}
