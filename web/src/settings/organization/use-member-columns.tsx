/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../../data-table/table-types";
import type { Membership } from "./use-w-03";
import { MembershipScopeCell } from "./MembershipScopeCell";
import { useProfileLabels } from "./use-profile-labels";
export function useMemberColumns(
  edit: (member: Membership) => void,
): DataTableColumn<Membership>[] {
  const { t } = useTranslation();
  const labelOf = useProfileLabels();
  return [
    {
      id: "user",
      headerKey: "users.members.user",
      cell: (member) => member.user_display_name ?? member.user,
    },
    {
      id: "profiles",
      headerKey: "users.members.profiles",
      cell: (member) => member.profiles.map(labelOf).join(" · ") || "—",
    },
    {
      id: "is_active",
      headerKey: "orgAdmin.members.status",
      cell: (member) =>
        t(member.is_active ? "orgAdmin.members.active" : "orgAdmin.members.inactive"),
    },
    {
      id: "scope",
      headerKey: "orgAdmin.members.scope",
      cell: (member) => (
        <MembershipScopeCell
          member={member}
          onEdit={() => {
            edit(member);
          }}
        />
      ),
    },
  ];
}
