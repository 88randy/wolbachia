import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { ScopeDialog } from "./ScopeDialog";
import { useRolesTable } from "./use-roles-table";
export function RolesTable() {
  const { t } = useTranslation();
  const table = useRolesTable();
  return (
    <>
      <p>{t("orgAdmin.roles.hint")}</p>
      <p role="status">{table.isSaved ? t("orgAdmin.action.saved") : ""}</p>
      <FilterBar controller={table.controller} />
      <DataTable
        caption={t("orgAdmin.roles.title")}
        columns={table.columns}
        getRowId={(profile) => profile.id}
        controller={table.controller}
        data={table.rows}
      />
      {table.editing && (
        <ScopeDialog
          target={{ kind: "role", record: table.editing }}
          codes={table.codes}
          onClose={table.close}
          onSaved={table.saved}
        />
      )}
    </>
  );
}
