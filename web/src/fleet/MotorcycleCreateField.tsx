import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import { TextField } from "../forms/TextField";
import { MOTORCYCLE_CODE_MAX, MOTORCYCLE_PLATE_MAX } from "./motorcycle-schema";
import type { MotorcycleValues } from "./motorcycle-schema";
const FIELDS = {
  code: {
    label: "fleet.column.code",
    max: MOTORCYCLE_CODE_MAX,
    invalid: "fleet.create.invalidCode",
  },
  plate: {
    label: "fleet.column.plate",
    max: MOTORCYCLE_PLATE_MAX,
    invalid: "fleet.create.invalidPlate",
  },
} as const;
export function MotorcycleCreateField({
  form,
  name,
}: {
  form: UseFormReturn<MotorcycleValues>;
  name: keyof MotorcycleValues;
}) {
  const { t } = useTranslation();
  const field = FIELDS[name];
  const issue = form.formState.errors[name];
  const error =
    issue === undefined
      ? undefined
      : t(
          issue.message === "errors.api.duplicateCode" ? "errors.api.duplicateCode" : field.invalid,
        );
  return (
    <TextField
      id={`motorcycle-${name}`}
      label={t(field.label)}
      maxLength={field.max}
      required={name === "code"}
      error={error}
      {...form.register(name)}
    />
  );
}
