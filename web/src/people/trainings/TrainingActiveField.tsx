import { useTranslation } from "react-i18next";
import { Switch } from "../../ui/Switch";
import type { useTrainingEditor } from "./use-training-editor";
export function TrainingActiveField({
  draft,
}: {
  draft: ReturnType<typeof useTrainingEditor>["draft"];
}) {
  const { t } = useTranslation();
  return (
    <Switch
      label={t("trainings.state.active")}
      disabled={draft.isLocked}
      isOn={draft.draft["is_active"] !== "false"}
      onChange={(checked) => {
        draft.setField("is_active", String(checked));
      }}
    />
  );
}
