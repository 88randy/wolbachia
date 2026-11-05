import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../../data-table/table-types";
import type { Membership } from "./use-w-03";
import { MembershipScopeCell } from "./MembershipScopeCell";
export function useMemberColumns(
  edit: (member: Membership) => void,
): DataTableColumn<Membership>[] {
  const { t } = useTranslation();
  return [
    { id: "user", headerKey: "orgAdmin.members.user", cell: (member) => member.user },
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
