import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { useSessionIdentity } from "../../session/use-session-identity";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { pageTableData } from "../../data-table/table-data";
import { membersOptions } from "./use-w-03";
import type { Membership } from "./use-w-03";
import { ADMIN_PAGE_SIZE, MEMBERS_TABLE } from "./admin-table";
import { useMemberColumns } from "./use-member-columns";
export function useMembershipsTable() {
  const controller = useTableUrlState(MEMBERS_TABLE);
  const query = useQuery(
    membersOptions({ client: useApiClient(), identity: useSessionIdentity() }, controller.state),
  );
  const [editing, setEditing] = useState<Membership | null>(null);
  const [isSaved, setSaved] = useState(false);
  const columns = useMemberColumns(setEditing);
  const close = () => {
    setEditing(null);
  };
  const saved = () => {
    close();
    setSaved(true);
  };
  return {
    controller,
    columns,
    editing,
    close,
    saved,
    isSaved,
    rows: pageTableData(query, controller.state.page, ADMIN_PAGE_SIZE),
  };
}
