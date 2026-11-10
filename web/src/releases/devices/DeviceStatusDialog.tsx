import { useTranslation } from "react-i18next";
import { PermitModal } from "../permits/PermitModal";
import { DeviceStatusForm } from "./DeviceStatusForm";
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
  const title = t("releases.devices.statusTitle", { code: device.code });
  return (
    <PermitModal title={title} isBusy={form.isBusy} onClose={onClose}>
      <DeviceStatusForm device={device} form={form} onClose={onClose} />
    </PermitModal>
  );
}
