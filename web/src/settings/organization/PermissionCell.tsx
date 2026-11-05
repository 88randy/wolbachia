import { useTranslation } from "react-i18next";
import { moveMatrixFocus } from "./matrix-keyboard";
interface Props {
  permission: string;
  label: string;
  isGranted: boolean;
  canEdit: boolean;
  onEdit: () => void;
}
export function PermissionCell({ permission, label, isGranted, canEdit, onEdit }: Props) {
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
      data-permission={permission}
      aria-label={`${label}: ${permission}`}
      aria-pressed={isGranted}
      onKeyDown={moveMatrixFocus}
      onClick={onEdit}
    >
      {permission}
      <span>{text}</span>
    </button>
  );
}
