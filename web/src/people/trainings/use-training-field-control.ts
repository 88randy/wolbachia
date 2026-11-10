import { useTranslation } from "react-i18next";
import { useBlurValidation } from "../../forms/use-blur-validation";
import { isTrainingFieldValid } from "./training-fields";
import type { TrainingField } from "./training-fields";
import type { TrainingDraft } from "./training-input";
import type { ChangeEvent, FocusEvent } from "react";
export interface TrainingFieldProps {
  field: TrainingField;
  draft: TrainingDraft;
  fieldPrefix: string;
  setField: (key: string, value: string) => void;
  hasSubmitted: boolean;
  isLocked?: boolean | undefined;
}
export function useTrainingFieldControl(props: TrainingFieldProps) {
  const { field, draft, hasSubmitted, setField } = props;
  const { t } = useTranslation();
  const validate = (value: string) =>
    isTrainingFieldValid(field, { ...draft, [field.key]: value })
      ? undefined
      : t("trainings.form.invalidField");
  const validation = useBlurValidation(validate);
  const error = isTrainingFieldValid(field, draft)
    ? undefined
    : hasSubmitted
      ? t("trainings.form.invalidField")
      : validation.error;
  return {
    error,
    onBlur: (event: FocusEvent<HTMLInputElement>) => {
      validation.onBlur(event.currentTarget.value);
    },
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      validation.onChange(event.currentTarget.value);
      setField(field.key, event.currentTarget.value);
    },
  };
}
