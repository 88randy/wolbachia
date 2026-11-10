import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import type { PointInput } from "./use-four-points";
import { MapPointPicker } from "../../map-picker/MapPointPicker";
import type { PickerArea } from "../../map-picker/picker-types";
import { parseLocation } from "./geometry";
interface Props {
  value: PointInput;
  onChange: (value: PointInput) => void;
  isDisabled?: boolean;
  areas?: readonly PickerArea[];
}
export function PointInputFields({ value, onChange, isDisabled, areas }: Props) {
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
      <MapPointPicker
        label={t("geography.field.location")}
        value={parseLocation(value.location)}
        areas={areas}
        onChange={(location) => {
          if (!isDisabled) onChange({ ...value, location: location.join(",") });
        }}
      />
    </fieldset>
  );
}
