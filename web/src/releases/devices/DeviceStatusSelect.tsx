import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "../../forms/Select";
import type { DeviceStatus } from "./devices-query";

const STATUSES: DeviceStatus[] = ["active", "inactive", "retired"];

interface Props {
  current: string;
  value: DeviceStatus;
  isBusy: boolean;
  onChange: (status: DeviceStatus) => void;
}

/** The statuses a device can move to: every one except the one it already has. */
export function DeviceStatusSelect({ current, value, isBusy, onChange }: Props) {
  const { t } = useTranslation();
  const options = STATUSES.filter((status) => status !== current).map((status) => ({
    value: status,
    label: t(`releases.devices.status.${status}`),
  }));
  return (
    <Select
      id={useId()}
      label={t("releases.devices.statusLabel")}
      value={value}
      disabled={isBusy}
      options={options}
      onChange={(event) => {
        onChange(event.target.value as DeviceStatus);
      }}
    />
  );
}
