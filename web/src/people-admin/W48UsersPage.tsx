import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { ListPage } from "../components/templates/ListPage";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useSessionIdentity } from "../session/use-session-identity";
import { NewUserButton } from "./NewUserButton";
import { usersQueryOptions } from "./users-query";
import type { Person } from "./users-query";
import { USERS_PAGE_SIZE, USERS_TABLE } from "./users-table";
import { usePeopleLookups } from "./use-people-lookups";
import { useUserColumns } from "./use-user-columns";

const getPersonId = (person: Person) => person.id;

/** W48 users: who works in the organization, their profiles, center and status. */
export function W48UsersPage() {
  const { t } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const controller = useTableUrlState(USERS_TABLE);
  const query = useQuery(usersQueryOptions(client, identity, controller.state));
  const columns = useUserColumns(usePeopleLookups());
  return (
    <ListPage
      title={t("users.page.title")}
      description={t("users.page.description")}
      actions={<NewUserButton />}
    >
      <FilterBar controller={controller} />
      <DataTable
        caption={t("users.table.caption")}
        columns={columns}
        getRowId={getPersonId}
        controller={controller}
        data={pageTableData(query, controller.state.page, USERS_PAGE_SIZE)}
      />
      <p className="m-0 text-xs text-ink-2">{t("users.page.retention")}</p>
    </ListPage>
  );
}
