import { useTranslation } from "react-i18next";
import type { Ref } from "react";
import { isTrainingFieldValid } from "./training-fields";
import type { TrainingField } from "./training-fields";
import type { TrainingDraft } from "./training-input";
interface Props {
  fields: readonly TrainingField[];
  draft: TrainingDraft;
  hasSubmitted: boolean;
  alertRef: Ref<HTMLDivElement>;
  fieldPrefix: string;
}
export function TrainingFormErrors({ fields, draft, hasSubmitted, alertRef, fieldPrefix }: Props) {
  const { t } = useTranslation();
  if (!hasSubmitted || fields.every((field) => isTrainingFieldValid(field, draft))) return null;
  return (
    <div role="alert" ref={alertRef} tabIndex={-1}>
      <p>{t("trainings.form.invalid")}</p>
      <p>{t("trainings.form.invalidHint")}</p>
      <ul>
        {fields
          .filter((field) => !isTrainingFieldValid(field, draft))
          .map((field) => (
            <li key={field.key}>
              <a href={`#${fieldPrefix}-${field.key}`}>{t(field.label)}</a>
            </li>
          ))}
      </ul>
    </div>
  );
}
