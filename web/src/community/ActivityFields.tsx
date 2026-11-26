import { useTranslation } from "react-i18next";
import { OptionPicker } from "../forms/OptionPicker";
import type { PickerOption } from "../forms/OptionPicker";
import { TextField } from "../forms/TextField";
import type { ActivityDraft, ActivityField } from "./use-activity-form";

interface Props {
  idBase: string;
  draft: ActivityDraft;
  errors: readonly ActivityField[];
  isOther: boolean;
  isSaving: boolean;
  types: readonly PickerOption[];
  zones: readonly PickerOption[];
  onChange: (field: ActivityField, value: string) => void;
}

/** Type and zone are chosen by name; attendance is a number; no field takes a neighbor's data. */
export function ActivityFields(props: Props) {
  const { idBase, draft, errors, isOther, isSaving, types, zones, onChange } = props;
  const { t } = useTranslation();
  const error = (field: ActivityField) =>
    errors.includes(field) ? t("community.form.required") : undefined;
  return (
    <>
      <OptionPicker
        id={`${idBase}-type`}
        label={t("community.form.type")}
        placeholder={t("community.form.typePlaceholder")}
        value={draft.typeId}
        options={types}
        disabled={isSaving}
        invalid={errors.includes("typeId")}
        error={error("typeId")}
        onChange={(value) => {
          onChange("typeId", value);
        }}
      />
      {isOther && (
        <TextField
          id={`${idBase}-other`}
          label={t("community.form.other")}
          value={draft.otherText}
          maxLength={200}
          error={error("otherText")}
          onChange={(event) => {
            onChange("otherText", event.currentTarget.value);
          }}
        />
      )}
      <OptionPicker
        id={`${idBase}-zone`}
        label={t("community.form.zone")}
        placeholder={t("community.form.zonePlaceholder")}
        value={draft.zoneId}
        options={zones}
        disabled={isSaving}
        invalid={errors.includes("zoneId")}
        error={error("zoneId")}
        onChange={(value) => {
          onChange("zoneId", value);
        }}
      />
      <TextField
        id={`${idBase}-attendance`}
        label={t("community.form.attendance")}
        inputMode="numeric"
        value={draft.attendance}
        error={errors.includes("attendance") ? t("community.form.attendanceInvalid") : undefined}
        onChange={(event) => {
          onChange("attendance", event.currentTarget.value);
        }}
      />
      <TextField
        id={`${idBase}-agreements`}
        label={t("community.form.agreements")}
        hint={t("community.form.agreementsHint")}
        value={draft.agreements}
        maxLength={1000}
        error={error("agreements")}
        onChange={(event) => {
          onChange("agreements", event.currentTarget.value);
        }}
      />
    </>
  );
}
