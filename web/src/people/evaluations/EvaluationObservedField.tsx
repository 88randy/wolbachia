/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): one declarative field. */
import { useTranslation } from "react-i18next";
import { useOrganizationTimeZone } from "../../format/use-time-zone";
import { TextField } from "../../forms/TextField";
import { DateField } from "../../ui/DateField";
import { fromLocalInput, toLocalInput } from "../trainings/TrainingInstantField";

interface Props {
  value: string;
  onChange: (value: string) => void;
  hasError: boolean;
}

const DEFAULT_TIME = "08:00";

/** When the work was observed: a calendar day and a short time of day. */
export function EvaluationObservedField({ value, onChange, hasError }: Props) {
  const { t } = useTranslation();
  const timeZone = useOrganizationTimeZone();
  const local = toLocalInput(value, timeZone);
  const day = local.slice(0, 10);
  const time = local.slice(11, 16);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-52">
        <DateField
          id="evaluation-observedAt"
          label={t("evaluations.field.observed")}
          size="xl"
          value={day}
          onChange={(next) => {
            onChange(fromLocalInput(`${next}T${time || DEFAULT_TIME}`, timeZone));
          }}
        />
      </div>
      <div className="w-44">
        <TextField
          id="evaluation-observedTime"
          label={t("evaluations.field.observedTime")}
          type="time"
          value={time || DEFAULT_TIME}
          error={hasError ? t("evaluations.form.invalid") : undefined}
          onChange={(event) => {
            if (day !== "")
              onChange(fromLocalInput(`${day}T${event.currentTarget.value}`, timeZone));
          }}
        />
      </div>
    </div>
  );
}
