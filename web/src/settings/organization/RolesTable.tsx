/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { ScopeDialog } from "./ScopeDialog";
import { CopyProfileDialog } from "./CopyProfileDialog";
import { useRolesTable } from "./use-roles-table";
export function RolesTable() {
  const { t, i18n } = useTranslation();
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
          returnFocusId={table.returnFocusId}
          onClose={table.close}
          onSaved={table.saved}
        />
      )}
      {table.copying && (
        <CopyProfileDialog
          profile={table.copying}
          name={i18n.language === "en" ? table.copying.label_en : table.copying.label_es}
          onClose={table.closeCopy}
          onCopied={table.copied}
        />
      )}
    </>
  );
}
