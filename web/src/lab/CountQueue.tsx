import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import type { TableController } from "../data-table/table-types";
import { queueOptions, PAGE_SIZE } from "./lab-query";
import type { Candidate, LabScope } from "./lab-query";
import { useQueueColumns } from "./use-queue-columns";
export function CountQueue({
  scope,
  controller,
  select,
}: {
  scope: LabScope;
  controller: TableController;
  select: (bag: Candidate) => void;
}) {
  const { t } = useTranslation();
  const query = useQuery(queueOptions(scope, controller.state));
  const columns = useQueueColumns(select);
  return (
    <section>
      <FilterBar controller={controller} />
      <DataTable
        caption={t("lab.queue.title")}
        columns={columns}
        getRowId={(bag) => bag.id}
        controller={controller}
        data={pageTableData(query, controller.state.page, PAGE_SIZE)}
      />
    </section>
  );
}
