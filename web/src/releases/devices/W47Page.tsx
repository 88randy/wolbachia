import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import { DeviceStatusDialog } from "./DeviceStatusDialog";
import { DevicesTable } from "./DevicesTable";
import type { ReleaseDevice } from "./devices-query";

/**
 * W47, release devices: the inventory by status with source lot and conditions. Changing a status
 * needs `permit.manage`; without it the button is disabled and says who can do it.
 */
export function W47Page() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<ReleaseDevice>();
  const close = () => {
    setEditing(undefined);
  };
  return (
    <ListPage title={t("releases.devices.title")}>
      <DevicesTable onChange={setEditing} />
      {editing !== undefined && (
        <DeviceStatusDialog device={editing} onClose={close} onSaved={close} />
      )}
    </ListPage>
  );
}
