import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FormAlert } from "../../forms/FormAlert";
import { PermitFormActions } from "../permits/PermitFormActions";
import { PermitModal } from "../permits/PermitModal";
import styles from "../permits/permits.module.css";
import { DeviceReasonField } from "./DeviceReasonField";
import { DeviceStatusSelect } from "./DeviceStatusSelect";
import type { ReleaseDevice } from "./devices-query";
import { useDeviceStatus } from "./use-device-status";

interface Props {
  device: ReleaseDevice;
  onClose: () => void;
  onSaved: () => void;
}

/** Change a device status (active, inactive, retired) with a required reason. */
export function DeviceStatusDialog({ device, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const form = useDeviceStatus(device, onSaved);
  const alertId = useId();
  const title = t("releases.devices.statusTitle", { code: device.code });
  return (
    <PermitModal title={title} isBusy={form.isBusy} onClose={onClose}>
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
          <FormAlert id={alertId} title={t("releases.devices.failed")} text={t(form.failure)} />
        )}
        <PermitFormActions
          isBusy={form.isBusy}
          onClose={onClose}
          labels={{ submit: "releases.devices.save", busy: "releases.devices.save" }}
        />
      </form>
    </PermitModal>
  );
}
