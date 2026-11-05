import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import type { PointInput } from "./use-four-points";
interface Props {
  value: PointInput;
  onChange: (value: PointInput) => void;
  isDisabled?: boolean;
}
export function PointInputFields({ value, onChange, isDisabled }: Props) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <fieldset disabled={isDisabled}>
      <legend>{value.code || t("geography.points.create")}</legend>
      <TextField
        id={id + "-code"}
        label={t("geography.points.code")}
        value={value.code}
        required
        onChange={(event) => {
          onChange({ ...value, code: event.target.value });
        }}
      />
      <TextField
        id={id + "-location"}
        label={t("geography.field.location")}
        value={value.location}
        required
        onChange={(event) => {
          onChange({ ...value, location: event.target.value });
        }}
      />
    </fieldset>
  );
}
