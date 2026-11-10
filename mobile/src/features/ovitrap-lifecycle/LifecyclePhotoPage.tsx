import { Camera, Undo2, X } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import type { LifecycleProps } from "./model.ts";

/** "Toma una foto": the photo is kept on the phone; a wrong one can be taken out. */
export function LifecyclePhotoPage({ model, draft }: LifecycleProps) {
  const t = useT();
  const run = (command: "captureEvidence" | "undoEvidence") => {
    void model.run(() => model.service[command](draft.eventId), draft.eventId);
  };
  return (
    <>
      <StepQuestion
        title={t("field.lifecycle.photoQuestion")}
        hint={t("field.lifecycle.photoHint")}
      />
      <SecondaryButton
        icon={Camera}
        label={t(draft.evidence.length ? "field.open.photoAgain" : "field.open.photoTake")}
        disabled={model.isBusy || !model.state}
        onPress={() => {
          run("captureEvidence");
        }}
      />
      {draft.evidence.map((item, index) => (
        <SecondaryButton
          key={item.id}
          icon={X}
          label={t("field.lifecycle.discardPhoto", { number: index + 1 })}
          disabled={model.isBusy}
          onPress={() => {
            void model.run(
              () => model.service.removeEvidence(item.id, draft.eventId),
              draft.eventId,
            );
          }}
        />
      ))}
      {draft.evidence.length > 0 ? (
        <InfoNotice tone="success" message={t("field.open.photoSaved")} />
      ) : null}
      {draft.discardedEvidence.length > 0 ? (
        <SecondaryButton
          icon={Undo2}
          label={t("field.lifecycle.restorePhoto")}
          disabled={model.isBusy}
          onPress={() => {
            run("undoEvidence");
          }}
        />
      ) : null}
    </>
  );
}
