import { ProfileScopeSummary } from "./ProfileScopeSummary";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../../data-table/table-types";
import { PermissionCells } from "./PermissionCells";
import type { Profile } from "./use-w-03";
const PROFILE_SCOPE_COLUMN: DataTableColumn<Profile> = {
  id: "scope",
  headerKey: "orgAdmin.roles.scope",
  cell: (profile) => <ProfileScopeSummary scope={profile.scope} />,
};
export function useRoleColumns(
  codes: string[],
  edit: (profile: Profile) => void,
): DataTableColumn<Profile>[] {
  const { i18n } = useTranslation();
  return [
    {
      id: "slug",
      headerKey: "orgAdmin.roles.profile",
      cell: (profile) => (i18n.language === "en" ? profile.label_en : profile.label_es),
    },
    PROFILE_SCOPE_COLUMN,
    {
      id: "permissions",
      headerKey: "orgAdmin.roles.permissions",
      cell: (profile) => (
        <PermissionCells
          profile={profile}
          codes={codes}
          onEdit={() => {
            edit(profile);
          }}
        />
      ),
    },
  ];
}
