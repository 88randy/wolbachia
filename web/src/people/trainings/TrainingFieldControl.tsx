import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { useTrainingFieldControl } from "./use-training-field-control";
import type { TrainingFieldProps } from "./use-training-field-control";
export function TrainingFieldControl(props: TrainingFieldProps) {
  const { t } = useTranslation();
  const { field } = props;
  const validation = useTrainingFieldControl(props);
  return (
    <TextField
      id={`${props.fieldPrefix}-${field.key}`}
      label={t(field.label)}
      value={props.draft[field.key] ?? ""}
      readOnly={field.isReadOnly || props.isLocked}
      {...validation}
      hint={field.hint ? t(field.hint) : undefined}
      inputMode={field.kind === "positive" ? "numeric" : undefined}
    />
  );
}
