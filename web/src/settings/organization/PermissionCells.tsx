import { ROLE_UPDATE } from "./permissions";
import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import { isReadOnlyProfile } from "./use-w-03";
import type { Profile } from "./use-w-03";
import { PermissionCell } from "./PermissionCell";
import styles from "./organization.module.css";
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
    <div className={styles.grants}>
      {codes.map((permission) => (
        <PermissionCell
          key={permission}
          permission={permission}
          label={label}
          isGranted={profile.permissions.includes(permission)}
          canEdit={canEdit}
          onEdit={onEdit}
        />
      ))}
      {!canEdit && <p>{t("orgAdmin.roles.readOnly")}</p>}
    </div>
  );
}
