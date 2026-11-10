import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import { DataTable } from "../../data-table/DataTable";
import { pageTableData } from "../../data-table/table-data";
import type { DataTableColumn } from "../../data-table/table-types";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { useCan } from "../../session/use-can";
import { Button } from "../../ui/Button";
import { EmptyValue } from "../../ui/EmptyValue";
import { StatusPill } from "../../ui/StatusPill";
import { useToast } from "../../ui/toast-context";
import { useLabScope } from "../use-lab-scope";
import { LabDialog } from "./LabDialog";
import { LAB_TABLE, PCR_MANAGE, labsOptions, pcrErrorKey } from "./pcr-api";
import type { ExternalLab } from "./pcr-api";

/** Catalog of external laboratories of the organization: created and deactivated, never deleted. */
export function PcrLabsPage() {
  const { t } = useTranslation();
  const can = useCan();
  const scope = useLabScope();
  const controller = useTableUrlState(LAB_TABLE);
  const query = useQuery(labsOptions(scope, controller.state.page));
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const toggle = useMutation({
    mutationFn: async (lab: ExternalLab) =>
      unwrap(
        await scope.client.PATCH("/api/v1/external-labs/{id}/", {
          params: { path: { id: lab.id } },
          body: { is_active: !lab.is_active },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      showToast({ message: t("pcr.labs.saved"), tone: "success" });
    },
    onError: (caught) => {
      showToast({ message: t(pcrErrorKey(caught)), tone: "critical" });
    },
  });
  const manage = can(PCR_MANAGE);
  const [editing, setEditing] = useState<ExternalLab>();
  const columns: DataTableColumn<ExternalLab>[] = [
    { id: "name", headerKey: "pcr.labs.name", cell: (row) => <span className="font-semibold">{row.name}</span> },
    { id: "contact", headerKey: "pcr.labs.contact", cell: (row) => row.contact || <EmptyValue /> },
    { id: "address", headerKey: "pcr.labs.address", cell: (row) => row.address || <EmptyValue /> },
    {
      id: "active",
      headerKey: "pcr.col.status",
      cell: (row) => (
        <StatusPill tone={row.is_active ? "success" : "neutral"}>
          {t(row.is_active ? "pcr.labs.active" : "pcr.labs.inactive")}
        </StatusPill>
      ),
    },
  ];
  return (
    <ListPage
      title={t("pcr.labs.title")}
      description={t("pcr.labs.description")}
      actions={
        manage ? (
          <LabDialog
            trigger={<Button leadingIcon={<Plus aria-hidden="true" />}>{t("pcr.labs.new")}</Button>}
          />
        ) : undefined
      }
    >
      <DataTable
        caption={t("pcr.labs.title")}
        columns={columns}
        getRowId={(row) => row.id}
        controller={controller}
        data={pageTableData(query, controller.state.page, LAB_TABLE.pageSize)}
        rowMenu={
          manage
            ? (row) => [
                {
                  id: "edit",
                  label: t("pcr.labs.edit"),
                  onSelect: () => {
                    setEditing(row);
                  },
                },
                {
                  id: "toggle",
                  label: t(row.is_active ? "pcr.labs.deactivate" : "pcr.labs.activate"),
                  destructive: row.is_active,
                  onSelect: () => {
                    toggle.mutate(row);
                  },
                },
              ]
            : undefined
        }
      />
      <LabDialog
        key={editing?.id ?? "none"}
        trigger={<span hidden />}
        lab={editing}
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        onSaved={() => {
          setEditing(undefined);
        }}
      />
    </ListPage>
  );
}
