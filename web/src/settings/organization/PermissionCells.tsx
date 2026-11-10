import { ROLE_UPDATE } from "./permissions";
import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import { isReadOnlyProfile } from "./use-w-03";
import type { Profile } from "./use-w-03";
import { PermissionCell } from "./PermissionCell";
interface Props {
  profile: Profile;
  codes: string[];
  onEdit: () => void;
}
export function PermissionCells({ profile, codes, onEdit }: Props) {
  const { t, i18n } = useTranslation();
  const canEdit = useMe().permissions.includes(ROLE_UPDATE) && !isReadOnlyProfile(profile);
  const label = i18n.language === "en" ? profile.label_en : profile.label_es;
  return (
    <div className="flex max-w-[880px] flex-wrap gap-1.5">
      {codes.map((permission) => (
        <PermissionCell
          key={permission}
          profileId={profile.id}
          permission={permission}
          label={label}
          isGranted={profile.permissions.includes(permission)}
          canEdit={canEdit}
          onEdit={onEdit}
        />
      ))}
      {!canEdit && <p className="m-0 w-full text-xs text-ink-2">{t("orgAdmin.roles.readOnly")}</p>}
    </div>
  );
}
