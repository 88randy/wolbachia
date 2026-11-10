import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useApiClient } from "../api/ApiClientProvider";
import { ListPage } from "../components/templates/ListPage";
import { DataTable } from "../data-table/DataTable";
import { pageTableData } from "../data-table/table-data";
import type { DataTableColumn, TableQueryConfig } from "../data-table/table-types";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useFormatCalendarDate, useFormatNumber } from "../format/use-formatters";
import { useCan } from "../session/use-can";
import { useSessionIdentity } from "../session/use-session-identity";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { InterventionForm } from "./InterventionForm";
import { interventionTypesOptions, interventionsOptions } from "./scheduling-queries";

const PAGE_SIZE = 25;
const TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  filters: [],
  sortableIds: [],
  supportsVoided: false,
};

type Row = Schemas["Intervention"];

/** W32: spraying, fogging or larvicide done by other institutions, so nobody repeats or contradicts it. */
export function W32Page() {
  const { t } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const can = useCan();
  const formatDay = useFormatCalendarDate();
  const formatNumber = useFormatNumber();
  const [isOpen, setIsOpen] = useState(false);
  const controller = useTableUrlState(TABLE);
  const query = useQuery(interventionsOptions(client, identity, controller.state.page, PAGE_SIZE));
  const types = useQuery(interventionTypesOptions(client, identity)).data ?? [];
  const typeName = (row: Row) => {
    const label = types.find((item) => item.id === row.type)?.label_es ?? row.type_code;
    return row.other_text ? `${label}: ${row.other_text}` : label;
  };
  const columns: readonly DataTableColumn<Row>[] = [
    { id: "type", headerKey: "scheduling.intervention.type", cell: typeName },
    { id: "product", headerKey: "scheduling.intervention.product", cell: (row) => row.product },
    { id: "source", headerKey: "scheduling.intervention.institution", cell: (row) => row.source },
    {
      id: "blocks",
      headerKey: "scheduling.intervention.blocksColumn",
      align: "end",
      cell: (row) => formatNumber(row.blocks.length),
    },
    {
      id: "dates",
      headerKey: "scheduling.intervention.dates",
      cell: (row) =>
        t("scheduling.intervention.range", {
          from: formatDay(row.date_from),
          to: formatDay(row.date_to),
        }),
    },
  ];
  return (
    <ListPage
      title={t("scheduling.intervention.title")}
      description={t("scheduling.intervention.description")}
      actions={
        can("intervention.create") && (
          <Dialog
            open={isOpen}
            onOpenChange={setIsOpen}
            title={t("scheduling.intervention.new")}
            description={t("scheduling.intervention.newHint")}
            trigger={
              <Button leadingIcon={<Plus aria-hidden="true" />}>
                {t("scheduling.intervention.new")}
              </Button>
            }
          >
            <InterventionForm
              onDone={() => {
                setIsOpen(false);
              }}
            />
          </Dialog>
        )
      }
    >
      <DataTable
        caption={t("scheduling.intervention.title")}
        columns={columns}
        controller={controller}
        getRowId={(row) => row.id}
        data={pageTableData(query, controller.state.page, PAGE_SIZE)}
      />
    </ListPage>
  );
}
