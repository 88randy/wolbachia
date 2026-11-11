import { useTranslation } from "react-i18next";
import { isoToZonedLocal, zonedLocalToIso } from "../../format/time-zone";
import { useOrganizationTimeZone } from "../../format/use-time-zone";
import { TextField } from "../../forms/TextField";
import { useTrainingFieldControl } from "./use-training-field-control";
import type { TrainingFieldProps } from "./use-training-field-control";

/** An ISO instant (stored in the draft) as the `YYYY-MM-DDTHH:mm` shown in the org's zone. */
export function toLocalInput(iso: string, timeZone: string): string {
  return iso === "" ? "" : isoToZonedLocal(iso, timeZone);
}

/** What the date-time input holds, as the aware instant the server wants (`""` while empty). */
export function fromLocalInput(local: string, timeZone: string): string {
  return zonedLocalToIso(local.slice(0, 16), timeZone) ?? "";
}

/** Date and time chosen with the browser calendar; nobody types an ISO instant. */
export function TrainingInstantField(props: TrainingFieldProps) {
  const { t } = useTranslation();
  const { field, draft, fieldPrefix, setField, isLocked } = props;
  const validation = useTrainingFieldControl(props);
  const timeZone = useOrganizationTimeZone();
  return (
    <TextField
      id={`${fieldPrefix}-${field.key}`}
      label={t(field.label)}
      type="datetime-local"
      value={toLocalInput(draft[field.key] ?? "", timeZone)}
      readOnly={field.isReadOnly || isLocked}
      error={validation.error}
      onChange={(event) => {
        setField(field.key, fromLocalInput(event.currentTarget.value, timeZone));
      }}
    />
  );
}
