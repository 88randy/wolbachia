import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { ClipboardCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LabChoiceDialog } from "./LabChoiceDialog";
import type { SampleRow } from "./lab-lists";
import { useLabAction } from "./use-lab-action";
import { useLabScope } from "./use-lab-scope";

type Outcome = "positive" | "negative" | "invalid";
const OUTCOMES: readonly Outcome[] = ["positive", "negative", "invalid"];

function bodyOf(sample: SampleRow, outcome: Outcome): Schemas["SampleResultRequest"] {
  const last = sample.attempts.at(-1);
  return {
    command_id: crypto.randomUUID(),
    status: outcome === "invalid" ? "invalid" : "valid",
    result: outcome === "invalid" ? null : outcome,
    method_version: sample.method_version_id,
    ...(last?.status === "invalid" ? { repeat_of: last.id } : {}),
  };
}

function useRecord(sample: SampleRow) {
  const scope = useLabScope();
  return useLabAction<Outcome>({
    successKey: "lab.results.saved",
    run: async (outcome, signal) =>
      unwrap(
        await scope.client.POST("/api/v1/wolbachia-samples/{id}/results/", {
          params: { path: { id: sample.id } },
          body: bodyOf(sample, outcome),
          signal,
        }),
      ),
  });
}

/** Records one attempt; after an invalid attempt the new one is linked as its repeat. */
export function RecordResultDialog({ sample }: { sample: SampleRow }) {
  const { t } = useTranslation();
  const action = useRecord(sample);
  const isRepeat = sample.result_status === "invalid";
  return (
    <LabChoiceDialog
      id={"outcome-" + sample.id}
      title={t("lab.results.recordTitle")}
      description={t("lab.results.recordHint")}
      triggerLabel={t(isRepeat ? "lab.results.repeat" : "lab.results.record")}
      icon={ClipboardCheck}
      fieldLabel={t("lab.results.outcome")}
      submitLabel={t("lab.results.save")}
      options={OUTCOMES.map((value) => ({ value, label: t(`lab.results.outcome.${value}`) }))}
      initial="negative"
      isBusy={action.isBusy}
      onSubmit={(value, close) => {
        action.submit(value as Outcome, close);
      }}
    />
  );
}
