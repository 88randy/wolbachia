import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { TextField } from "../../forms/TextField";
import { splitValues } from "./training-input";
import type { TrainingFieldProps } from "./use-training-field-control";

/** Actions a course can enable that the app gates by training today. */
const KNOWN_ACTIONS = ["release.record"] as const;
type KnownAction = (typeof KNOWN_ACTIONS)[number];

const isKnown = (action: string): action is KnownAction =>
  (KNOWN_ACTIONS as readonly string[]).includes(action);

/** Fields holding action codes: `enabled_actions` takes several, `action` takes one. */
export const ACTION_FIELDS = ["enabled_actions", "action"];

function toggle(current: string[], action: string, checked: boolean, multiple: boolean): string[] {
  if (!checked) return current.filter((item) => item !== action);
  return multiple ? [...current, action] : [action, ...current.filter((item) => !isKnown(item))];
}

/** Known actions are boxes to tick; "Other (specify)" takes a code for any action not listed. */
export function TrainingActionsField(props: TrainingFieldProps) {
  const { t } = useTranslation();
  const { field, draft, fieldPrefix, setField, isLocked } = props;
  const multiple = field.key === "enabled_actions";
  const selected = splitValues(draft[field.key] ?? "");
  const others = selected.filter((action) => !isKnown(action));
  const write = (next: string[]) => {
    setField(field.key, next.join(", "));
  };
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-[13px] font-semibold text-ink">{t(field.label)}</legend>
      {KNOWN_ACTIONS.map((action) => (
        <label key={action} className="flex items-center gap-2 text-sm text-ink">
          <Checkbox
            checked={selected.includes(action)}
            disabled={isLocked ?? false}
            onCheckedChange={(checked) => {
              write(toggle(selected, action, checked === true, multiple));
            }}
          />
          {t(`trainings.action.${action}`)}
        </label>
      ))}
      <TextField
        id={`${fieldPrefix}-${field.key}-other`}
        label={t("trainings.field.otherAction")}
        value={others.join(", ")}
        readOnly={isLocked ?? false}
        onChange={(event) => {
          write([...selected.filter(isKnown), ...splitValues(event.currentTarget.value)]);
        }}
      />
    </fieldset>
  );
}
