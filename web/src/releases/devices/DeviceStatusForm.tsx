import { useTranslation } from "react-i18next";
import { FormAlert } from "../../forms/FormAlert";
import { PermitFormActions } from "../permits/PermitFormActions";
import styles from "../permits/permits.module.css";
import { DeviceReasonField } from "./DeviceReasonField";
import { DeviceStatusSelect } from "./DeviceStatusSelect";
import type { ReleaseDevice } from "./devices-query";
import type { useDeviceStatus } from "./use-device-status";

interface Props {
  device: ReleaseDevice;
  form: ReturnType<typeof useDeviceStatus>;
  onClose: () => void;
}

/** New status, required reason, the failure if the server refused, and the actions. */
export function DeviceStatusForm({ device, form, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <form className={styles.form} onSubmit={form.send} noValidate>
      <DeviceStatusSelect
        current={device.status}
        value={form.status}
        isBusy={form.isBusy}
        onChange={form.setStatus}
      />
      <DeviceReasonField
        value={form.reason}
        hasError={form.reasonError}
        isBusy={form.isBusy}
        onChange={form.setReason}
      />
      {form.failure !== undefined && (
        <FormAlert
          id={`${device.id}-failure`}
          title={t("releases.devices.failed")}
          text={t(form.failure)}
        />
      )}
      <PermitFormActions
        isBusy={form.isBusy}
        onClose={onClose}
        labels={{ submit: "releases.devices.save", busy: "releases.devices.save" }}
      />
    </form>
  );
}
