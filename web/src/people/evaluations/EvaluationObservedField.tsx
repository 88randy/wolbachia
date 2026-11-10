import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { fromLocalInput, toLocalInput } from "../trainings/TrainingInstantField";

interface Props {
  value: string;
  onChange: (value: string) => void;
  hasError: boolean;
}

/** When the work was observed, chosen with the browser calendar and clock. */
export function EvaluationObservedField({ value, onChange, hasError }: Props) {
  const { t } = useTranslation();
  return (
    <TextField
      id="evaluation-observedAt"
      label={t("evaluations.field.observed")}
      type="datetime-local"
      value={toLocalInput(value)}
      error={hasError ? t("evaluations.form.invalid") : undefined}
      onChange={(event) => {
        onChange(fromLocalInput(event.currentTarget.value));
      }}
    />
  );
}
