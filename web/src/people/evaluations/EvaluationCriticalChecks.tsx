import { useTranslation } from "react-i18next";
import { Select } from "../../forms/Select";
import { readRubric } from "./evaluation-domain";
import type { RubricVersion } from "./evaluation-query";
import type { EvaluationFormModel } from "./use-evaluation-form";
interface Props {
  version: RubricVersion;
  form: Pick<EvaluationFormModel, "draft" | "answer">;
}
export function EvaluationCriticalChecks({ version, form }: Props) {
  const { t } = useTranslation();
  const checks = readRubric(version)?.checks ?? [];
  const options = [
    { value: "", label: t("evaluations.field.unanswered") },
    { value: "true", label: t("evaluations.field.yes") },
    { value: "false", label: t("evaluations.field.no") },
  ];
  return (
    <>
      {checks.map((key, index) => (
        <Select
          key={key}
          id={`evaluation-check-${String(index)}`}
          label={key}
          options={options}
          value={form.draft.critical[key] ?? ""}
          onChange={(event) => {
            form.answer(key, event.target.value);
          }}
        />
      ))}
    </>
  );
}
