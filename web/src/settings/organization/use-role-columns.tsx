/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { ProfileScopeSummary } from "./ProfileScopeSummary";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../../data-table/table-types";
import { PermissionCells } from "./PermissionCells";
import { ProfileMembersCell } from "./ProfileMembersCell";
import { useMe } from "../../session/use-me";
import { Button } from "../../ui/Button";
import { ROLE_UPDATE } from "./permissions";
import type { Profile } from "./use-w-03";
const PROFILE_SCOPE_COLUMN: DataTableColumn<Profile> = {
  id: "scope",
  headerKey: "orgAdmin.roles.scope",
  cell: (profile) => <ProfileScopeSummary scope={profile.scope} />,
};
export function useRoleColumns(
  codes: string[],
  edit: (profile: Profile) => void,
  copy: (profile: Profile) => void,
): DataTableColumn<Profile>[] {
  const { t, i18n } = useTranslation();
  const canCopy = useMe().permissions.includes(ROLE_UPDATE);
  const labelOf = (profile: Profile) =>
    i18n.language === "en" ? profile.label_en : profile.label_es;
  const columns: DataTableColumn<Profile>[] = [
    {
      id: "slug",
      headerKey: "orgAdmin.roles.profile",
      cell: labelOf,
    },
    PROFILE_SCOPE_COLUMN,
    {
      id: "members",
      headerKey: "users.roles.members",
      cell: (profile) => <ProfileMembersCell profile={profile} label={labelOf(profile)} />,
    },
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
  if (!canCopy) return columns;
  return [
    ...columns,
    {
      id: "copy",
      headerKey: "common.actions.rowActions",
      cell: (profile) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            copy(profile);
          }}
        >
          {t("users.roles.copy")}
        </Button>
      ),
    },
  ];
}
