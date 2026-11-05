import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { useMe } from "../../session/use-me";
import { useSessionIdentity } from "../../session/use-session-identity";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { pageTableData } from "../../data-table/table-data";
import { rolesOptions } from "./use-w-03";
import type { Profile } from "./use-w-03";
import { ADMIN_PAGE_SIZE, ROLES_TABLE } from "./admin-table";
import { useRoleColumns } from "./use-role-columns";
function permissionCodes(permissions: string[], profiles: Profile[]): string[] {
  return [
    ...new Set([...permissions, ...profiles.flatMap((profile) => profile.permissions)]),
  ].sort();
}
export function useRolesTable() {
  const me = useMe();
  const controller = useTableUrlState(ROLES_TABLE);
  const query = useQuery(
    rolesOptions({ client: useApiClient(), identity: useSessionIdentity() }, controller.state),
  );
  const [editing, setEditing] = useState<Profile | null>(null);
  const [isSaved, setSaved] = useState(false);
  const codes = permissionCodes(me.permissions, query.data?.results ?? []);
  const columns = useRoleColumns(codes, (profile) => {
    setEditing(profile);
    setSaved(false);
  });
  const close = () => {
    setEditing(null);
  };
  const saved = () => {
    close();
    setSaved(true);
  };
  const rows = pageTableData(query, controller.state.page, ADMIN_PAGE_SIZE);
  return { controller, columns, codes, editing, close, saved, isSaved, rows };
}
