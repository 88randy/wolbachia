import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";

interface Props {
  canManage: boolean;
  onChange: () => void;
}

/** "Change status" of one device row; disabled with the reason when the user cannot manage. */
export function DeviceRowAction({ canManage, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <Button
      variant="tertiary"
      size="sm"
      disabled={!canManage}
      title={canManage ? undefined : t("releases.devices.noPermission")}
      onClick={onChange}
    >
      {t("releases.devices.changeStatus")}
    </Button>
  );
}
