import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { DataTableColumn } from "../data-table/table-types";
import type { Candidate } from "./lab-query";
/** The table shows one server page; selection never filters the server's queue. */
export function useQueueColumns(select: (bag: Candidate) => void): DataTableColumn<Candidate>[] {
  const { t } = useTranslation();
  return [{ id: "code", headerKey: "lab.queue.bag",
    cell: (bag) => <Button variant="ghost" onClick={() => { select(bag); }}>{bag.code}</Button>,
  }, { id: "status", headerKey: "lab.queue.status", cell: (bag) => t(bag.is_lagged ? "lab.bag.lagged" : "lab.bag.onTime") }];
}
