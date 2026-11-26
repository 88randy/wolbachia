import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { OptionPicker } from "../../forms/OptionPicker";
import { rubricChoicesOptions } from "./evaluation-query";
import type { EvaluationScope } from "./evaluation-query";
import type { RubricLookupModel } from "./use-rubric-lookup";

interface Props {
  scope: EvaluationScope;
  model: RubricLookupModel;
}

/** The rubric is chosen by name from the organization's list; nobody types its code. */
export function RubricLookupForm({ scope, model }: Props) {
  const { t } = useTranslation();
  const choices = useQuery(rubricChoicesOptions(scope));
  const options = (choices.data?.results ?? []).map((row) => ({
    value: row.code,
    label: row.name,
    hint: row.code,
  }));
  return (
    <OptionPicker
      id="evaluation-rubric-code"
      label={t("evaluations.rubric.code")}
      placeholder={t("trainings.field.pickPlaceholder")}
      value={model.code}
      options={options}
      isLoading={choices.isPending}
      onChange={model.choose}
    />
  );
}
