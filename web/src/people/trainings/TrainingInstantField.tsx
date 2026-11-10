import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { useTrainingFieldControl } from "./use-training-field-control";
import type { TrainingFieldProps } from "./use-training-field-control";

const LOCAL_FORMAT = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** An ISO instant (stored in the draft) as the `YYYY-MM-DDTHH:mm` a date-time input shows. */
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (iso === "" || Number.isNaN(date.getTime())) return "";
  const day = `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** What the date-time input holds, as the aware instant the server wants (`""` while empty). */
export function fromLocalInput(local: string): string {
  if (!LOCAL_FORMAT.test(local)) return "";
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** Date and time chosen with the browser calendar; nobody types an ISO instant. */
export function TrainingInstantField(props: TrainingFieldProps) {
  const { t } = useTranslation();
  const { field, draft, fieldPrefix, setField, isLocked } = props;
  const validation = useTrainingFieldControl(props);
  return (
    <TextField
      id={`${fieldPrefix}-${field.key}`}
      label={t(field.label)}
      type="datetime-local"
      value={toLocalInput(draft[field.key] ?? "")}
      readOnly={field.isReadOnly || isLocked}
      error={validation.error}
      onChange={(event) => {
        setField(field.key, fromLocalInput(event.currentTarget.value));
      }}
    />
  );
}
