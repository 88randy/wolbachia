import { ROLE_UPDATE } from "./permissions";
import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import type { Membership } from "./use-w-03";
interface Props {
  member: Membership;
  onEdit: () => void;
}
export function MembershipScopeCell({ member, onEdit }: Props) {
  const { t } = useTranslation();
  const canEdit = useMe().permissions.includes(ROLE_UPDATE);
  return (
    <>
      <span>{t(`orgAdmin.scope.${member.scope.centers.mode}`)}</span>
      {canEdit && (
        <button
          type="button"
          disabled={!member.is_active}
          title={!member.is_active ? t("orgAdmin.members.blocked") : undefined}
          onClick={onEdit}
        >
          {t("orgAdmin.members.edit")}
        </button>
      )}
    </>
  );
}
