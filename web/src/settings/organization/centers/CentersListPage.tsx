import { useQuery } from "@tanstack/react-query";
import type { LinkProps } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ListPage } from "../../../components/templates/ListPage";
import { DataTable } from "../../../data-table/DataTable";
import { FilterBar } from "../../../data-table/FilterBar";
import { pageTableData } from "../../../data-table/table-data";
import { useTableUrlState } from "../../../data-table/use-table-url-state";
import { useCan } from "../../../session/use-can";
import { Button } from "../../../ui/Button";
import { CENTER_CREATE, CENTERS_TABLE, centersListOptions } from "./centers-api";
import type { CenterRow } from "./centers-api";
import { CenterFormDialog } from "./CenterFormDialog";
import { useCenterColumns } from "./use-center-columns";
import { useCenterMenu } from "./use-center-menu";
import { useCentersScope } from "./use-centers-scope";

const getCenterId = (center: CenterRow) => center.id;
const linkOf = (row: CenterRow): LinkProps => ({
  to: "/settings/organization/centers/$code",
  params: { code: row.code },
});

function EditDialog({
  center,
  onClose,
}: {
  center: CenterRow | undefined;
  onClose: (center: undefined) => void;
}) {
  return (
    <CenterFormDialog
      key={center?.id ?? "none"}
      trigger={<span hidden />}
      center={center}
      open={center !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose(undefined);
      }}
    />
  );
}

function NewCenterButton() {
  const { t } = useTranslation();
  return (
    <CenterFormDialog
      trigger={
        <Button leadingIcon={<Plus aria-hidden="true" />}>{t("centersAdmin.action.new")}</Button>
      }
    />
  );
}

/** Settings → Organización → Centros: the centers list (no W-code in docs/web-screens.md). */
export function CentersListPage() {
  const { t } = useTranslation();
  const can = useCan();
  const controller = useTableUrlState(CENTERS_TABLE);
  const query = useQuery(centersListOptions(useCentersScope(), controller.state));
  const [editing, setEditing] = useState<CenterRow>();
  const columns = useCenterColumns();
  const rowMenu = useCenterMenu(setEditing);
  return (
    <ListPage
      title={t("centersAdmin.page.title")}
      description={t("centersAdmin.page.description")}
      actions={can(CENTER_CREATE) ? <NewCenterButton /> : undefined}
    >
      <FilterBar controller={controller} />
      <DataTable
        caption={t("centersAdmin.page.title")}
        columns={columns}
        getRowId={getCenterId}
        controller={controller}
        data={pageTableData(query, controller.state.page, CENTERS_TABLE.pageSize)}
        rowMenu={rowMenu}
        rowLink={linkOf}
      />
      <EditDialog center={editing} onClose={setEditing} />
    </ListPage>
  );
}
