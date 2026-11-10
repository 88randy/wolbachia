import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { ACTION_FIELDS, TrainingActionsField } from "./TrainingActionsField";
import { TrainingInstantField } from "./TrainingInstantField";
import { LOOKUP_OF_FIELD, TrainingLookupPicker } from "./TrainingLookupPicker";
import { TrainingVersionsField } from "./TrainingVersionsField";
import { useTrainingFieldControl } from "./use-training-field-control";
import type { TrainingFieldProps } from "./use-training-field-control";

/**
 * One field of the training forms. Ids are chosen by name (people, centers, quadrants, courses,
 * versions), dates with a calendar and actions from a list: nothing here asks for a pasted id
 * or an ISO date. Other fields stay plain text.
 */
export function TrainingFieldControl(props: TrainingFieldProps) {
  const { field } = props;
  if (field.key === "evidence_ids") return null;
  if (field.key in LOOKUP_OF_FIELD) return <TrainingLookupPicker {...props} />;
  if (field.key === "versions") return <TrainingVersionsField {...props} />;
  if (field.kind === "instant") return <TrainingInstantField {...props} />;
  if (ACTION_FIELDS.includes(field.key)) return <TrainingActionsField {...props} />;
  return <TrainingTextField {...props} />;
}

function TrainingTextField(props: TrainingFieldProps) {
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
