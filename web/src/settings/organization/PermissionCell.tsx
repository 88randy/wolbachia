import { useTranslation } from "react-i18next";
import { moveMatrixFocus } from "./matrix-keyboard";
interface Props {
  profileId: string;
  permission: string;
  label: string;
  isGranted: boolean;
  canEdit: boolean;
  onEdit: () => void;
}
export function PermissionCell(props: Props) {
  const { profileId, permission, label, isGranted, canEdit, onEdit } = props;
  const { t } = useTranslation();
  const text = t(isGranted ? "orgAdmin.roles.granted" : "orgAdmin.roles.denied");
  if (!canEdit)
    return (
      <span>
        {permission}
        <strong>{text}</strong>
      </span>
    );
  return (
    <button
      type="button"
      id={`permission-${profileId}-${permission}`}
      data-permission={permission}
      aria-label={`${label}: ${permission} ${text}`}
      aria-pressed={isGranted}
      onKeyDown={moveMatrixFocus}
      onClick={onEdit}
    >
      {permission} <span>{text}</span>
    </button>
  );
}
