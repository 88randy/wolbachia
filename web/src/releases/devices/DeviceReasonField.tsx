import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FieldNotes } from "../../forms/FieldNotes";
import { classNames } from "../../styles/class-names";
import dialog from "../../void/void-dialog.module.css";
import { DEVICE_REASON_MIN } from "./use-device-status";

interface Props {
  value: string;
  hasError: boolean;
  isBusy: boolean;
  onChange: (value: string) => void;
}

/** Required written reason for a device status change. */
export function DeviceReasonField({ value, hasError, isBusy, onChange }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const hint = t("releases.devices.reasonHint", { min: DEVICE_REASON_MIN });
  return (
    <div className={dialog.field}>
      <label htmlFor={id} className={dialog.label}>
        {t("releases.devices.reasonLabel")}
      </label>
      <textarea
        id={id}
        className={classNames(dialog.textarea, hasError && dialog.invalid)}
        value={value}
        maxLength={1000}
        required
        disabled={isBusy}
        aria-invalid={hasError ? true : undefined}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
      />
      <FieldNotes id={id} hint={hint} error={hasError ? hint : undefined} />
    </div>
  );
}
