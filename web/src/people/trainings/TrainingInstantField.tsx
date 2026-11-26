import { useTranslation } from "react-i18next";
import { isoToZonedLocal, zonedLocalToIso } from "../../format/time-zone";
import { useOrganizationTimeZone } from "../../format/use-time-zone";
import { DateField } from "../../ui/DateField";
import { FieldNotes } from "../../forms/FieldNotes";
import { useTrainingFieldControl } from "./use-training-field-control";
import type { TrainingFieldProps } from "./use-training-field-control";

/** An ISO instant (stored in the draft) as local "date T time" in the organization's zone. */
export function toLocalInput(iso: string, timeZone: string): string {
  return iso === "" ? "" : isoToZonedLocal(iso, timeZone);
}

/** What the inputs hold, as the aware instant the server wants (empty while incomplete). */
export function fromLocalInput(local: string, timeZone: string): string {
  return zonedLocalToIso(local.slice(0, 16), timeZone) ?? "";
}

/** The day is picked from a calendar; an end date covers its whole day, a start date begins it. */
export function TrainingInstantField(props: TrainingFieldProps) {
  const { t } = useTranslation();
  const { field, draft, fieldPrefix, setField, isLocked } = props;
  const validation = useTrainingFieldControl(props);
  const timeZone = useOrganizationTimeZone();
  const id = `${fieldPrefix}-${field.key}`;
  const time = field.key === "valid_to" ? "23:59" : "00:00";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <DateField
        id={id}
        label={t(field.label)}
        value={toLocalInput(draft[field.key] ?? "", timeZone).slice(0, 10)}
        disabled={Boolean(field.isReadOnly) || Boolean(isLocked)}
        onChange={(day) => {
          setField(field.key, fromLocalInput(`${day}T${time}`, timeZone));
        }}
      />
      <FieldNotes id={id} error={validation.error} />
    </div>
  );
}
