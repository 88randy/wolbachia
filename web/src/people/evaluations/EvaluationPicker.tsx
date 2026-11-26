import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { OptionPicker } from "../../forms/OptionPicker";
import type { PickerOption } from "../../forms/OptionPicker";
import { trainingLookupsOptions } from "../trainings/training-lookups";
import type { ListName } from "../trainings/training-lookups";
import { useTrainingScope } from "../trainings/use-training-scope";

/** Which lookup list names each evaluation field that holds a record. */
export const PICKER_LISTS: Record<string, ListName> = {
  subject: "people",
  center: "centers",
  quadrant: "quadrants",
};

interface Props {
  name: string;
  labelKey: MessageKey;
  value: string;
  onChange: (value: string) => void;
  isInvalid: boolean;
  isSubmitted: boolean;
  isOptional: boolean;
}

/** The person, center or quadrant of an evaluation, chosen by name; the draft keeps its id. */
export function EvaluationPicker(props: Props) {
  const { t } = useTranslation();
  const query = useQuery(trainingLookupsOptions(useTrainingScope()));
  const list = query.data?.[PICKER_LISTS[props.name] ?? "people"] ?? [];
  const none: PickerOption[] = props.isOptional
    ? [{ value: "", label: t("trainings.field.noneOption") }]
    : [];
  const hasError = props.isSubmitted && props.isInvalid;
  return (
    <OptionPicker
      id={`evaluation-${props.name}`}
      label={t(props.labelKey)}
      placeholder={t("trainings.field.pickPlaceholder")}
      value={props.value}
      options={[...none, ...list]}
      isLoading={query.isPending}
      invalid={hasError}
      error={hasError ? t("evaluations.form.invalid") : undefined}
      onChange={props.onChange}
    />
  );
}
