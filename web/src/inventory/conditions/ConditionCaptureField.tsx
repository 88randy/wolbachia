import { useTranslation } from "react-i18next";
import type { ChangeEvent } from "react";
import { TextField } from "../../forms/TextField";
import type { CaptureValues, useConditionCapture } from "./use-condition-capture";
const LABELS = {
  device_time: "conditions.field.instant",
  temperature_c: "conditions.field.temperature",
  humidity_pct: "conditions.field.humidity",
} as const;
const OFFSET_INSTANT =
  "[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?(Z|\\+[0-9]{2}:[0-9]{2}|-[0-9]{2}:[0-9]{2})";
export function ConditionCaptureField({
  field,
  capture,
}: {
  field: keyof CaptureValues;
  capture: ReturnType<typeof useConditionCapture>;
}) {
  const { t } = useTranslation();
  const isInstant = field === "device_time";
  const attributes = {
    id: `condition-${field}`,
    label: t(LABELS[field]),
    type: isInstant ? "text" : "number",
    step: isInstant ? undefined : "any",
    pattern: isInstant ? OFFSET_INSTANT : undefined,
    required: true,
    value: capture.values[field],
    error: capture.state.errors[field] ? t(capture.state.errors[field]) : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      capture.setValues((previous) => ({ ...previous, [field]: event.target.value }));
    },
  };
  return <TextField {...attributes} />;
}
