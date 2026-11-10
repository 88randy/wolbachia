import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { CapturePhoto } from "./CapturePhoto.tsx";
import { eligibleReuse } from "./capture-pages.ts";
import { PLACEMENT_PREPARATION, PREPARATION } from "./domain.ts";
import type { CaptureProps } from "./model.ts";

/** "Prepara y deja lista la ovitrampa": each step is a big row you tap when it is done. */
export function PreparePage({ model, draft }: CaptureProps) {
  const t = useT();
  const required = draft.mode === "place" ? PLACEMENT_PREPARATION : PREPARATION;
  const reuse = eligibleReuse(draft, model.state?.reuse ?? []);
  return (
    <>
      <StepQuestion
        title={t("field.capture.prepareQuestion")}
        hint={t("field.capture.prepareHint")}
      />
      <View className="gap-3">
        {required.map((key) => {
          const isDone = draft.prepared.includes(key);
          return (
            <ChoiceRow
              key={key}
              label={t(`field.capture.prep.${key}`)}
              isSelected={isDone}
              disabled={model.isBusy}
              onPress={() => {
                model.edit(
                  {
                    prepared: isDone
                      ? draft.prepared.filter((item) => item !== key)
                      : [...draft.prepared, key],
                  },
                  draft.eventId,
                );
              }}
            />
          );
        })}
      </View>
      <StepQuestion title={t("field.capture.paddleQuestion")} />
      <View accessibilityRole="radiogroup" className="gap-3">
        <ChoiceRow
          label={t("field.capture.newPaddle")}
          isSelected={draft.reuseId === null}
          disabled={model.isBusy}
          onPress={() => {
            model.edit({ reuseId: null }, draft.eventId);
          }}
        />
        {reuse.map((item) => (
          <ChoiceRow
            key={item.id}
            label={t("field.capture.reusePaddle", { count: item.reuses })}
            isSelected={draft.reuseId === item.id}
            disabled={model.isBusy}
            onPress={() => {
              model.edit({ reuseId: item.id }, draft.eventId);
            }}
          />
        ))}
      </View>
      {draft.mode === "place" ? <CapturePhoto model={model} draft={draft} /> : null}
    </>
  );
}
