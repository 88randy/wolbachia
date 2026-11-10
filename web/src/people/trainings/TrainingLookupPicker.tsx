import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { OptionPicker } from "../../forms/OptionPicker";
import type { PickerOption } from "../../forms/OptionPicker";
import { useTrainingScope } from "./use-training-scope";
import { trainingLookupsOptions } from "./training-lookups";
import type { TrainingLookups } from "./training-lookups";
import type { TrainingFieldProps } from "./use-training-field-control";

/** Which lookup list feeds each field that used to take a pasted id. */
export const LOOKUP_OF_FIELD: Record<string, keyof TrainingLookups> = {
  subject: "people",
  center: "centers",
  quadrant: "quadrants",
  training: "courses",
  training_version: "courseVersions",
};

/** A person, center, quadrant or course chosen by name; the draft keeps the id behind it. */
export function TrainingLookupPicker(props: TrainingFieldProps) {
  const { t } = useTranslation();
  const { field, draft, fieldPrefix, setField, isLocked, hasSubmitted } = props;
  const query = useQuery(trainingLookupsOptions(useTrainingScope()));
  const list = query.data?.[LOOKUP_OF_FIELD[field.key] ?? "people"] ?? [];
  const none: PickerOption[] = field.isOptional
    ? [{ value: "", label: t("trainings.field.noneOption") }]
    : [];
  const value = draft[field.key] ?? "";
  const isMissing = hasSubmitted && !field.isOptional && value === "";
  return (
    <OptionPicker
      id={`${fieldPrefix}-${field.key}`}
      label={t(field.label)}
      placeholder={t("trainings.field.pickPlaceholder")}
      value={value}
      options={[...none, ...list]}
      isLoading={query.isPending}
      disabled={isLocked ?? false}
      invalid={isMissing}
      error={isMissing ? t("trainings.form.invalidField") : undefined}
      onChange={(next) => {
        setField(field.key, next);
      }}
    />
  );
}
