import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { ScopeDialog } from "./ScopeDialog";
import { useMembershipsTable } from "./use-memberships-table";
export function MembershipsTable() {
  const { t } = useTranslation();
  const table = useMembershipsTable();
  return (
    <>
      <p role="status">{table.isSaved ? t("orgAdmin.action.saved") : ""}</p>
      <FilterBar controller={table.controller} />
      <DataTable
        caption={t("orgAdmin.members.title")}
        columns={table.columns}
        getRowId={(member) => member.id}
        controller={table.controller}
        data={table.rows}
      />
      {table.editing && (
        <ScopeDialog
          target={{ kind: "membership", record: table.editing }}
          codes={[]}
          onClose={table.close}
          onSaved={table.saved}
        />
      )}
    </>
  );
}
