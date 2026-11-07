import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { DataTable } from "../data-table/DataTable";
import { pageTableData } from "../data-table/table-data";
import { useFormatDateTime } from "../format/use-format-date-time";
import { useVoidReasonLabel, voidInfoOf } from "../void";
import { useFleetAuthor } from "./use-fleet-author";
import { useFleetHistoryTable } from "./use-fleet-history-table";
import { useFleetHistoryColumns } from "./fleet-history-columns";
import type { HistoryActions } from "./fleet-history-columns";
import { fleetHistoryOptions } from "./fleet-history-query";
import type { HistoryRow } from "./fleet-history-query";
import type { HistoryTab } from "./fleet-history-table";
import { FLEET_PAGE_SIZE } from "./fleet-table";
import { TAB_KEYS } from "./use-fleet-tabs";
import { FleetFilters } from "./FleetFilters";
import { FleetHistoryVoidDialog } from "./FleetHistoryVoidDialog";
interface Props {
  motorcycle: string;
  tab: HistoryTab;
  actions: Omit<HistoryActions, "onVoid" | "state">;
}
function useHistoryModel({ motorcycle, tab, actions }: Props) {
  const { controller, source } = useFleetHistoryTable(tab);
  const [voiding, setVoiding] = useState<{
    row: Schemas["ServiceRecord"] | Schemas["ResponsibilityLetter"];
    context: string;
  }>();
  const query = useQuery(fleetHistoryOptions(actions.scope, { motorcycle, tab }, controller.state));
  const isUnverified =
    actions.isUnverified || query.isFetching || query.isPlaceholderData || query.error !== null;
  const columns = useFleetHistoryColumns(tab, actions.scope.code, {
    ...actions,
    isUnverified,
    state: controller.state,
    onVoid: (row) => {
      if (actions.canManage && !isUnverified) setVoiding({ row, context: actions.scope.context });
    },
  });
  return {
    controller,
    source,
    query,
    columns,
    voiding,
    close: () => {
      setVoiding(undefined);
    },
  };
}
type Model = ReturnType<typeof useHistoryModel>;
function HistoryRows({ model, tab }: { model: Model; tab: HistoryTab }) {
  const { t } = useTranslation();
  const author = useFleetAuthor();
  const format = useFormatDateTime();
  const reasonLabel = useVoidReasonLabel();
  return (
    <DataTable<HistoryRow>
      caption={t(TAB_KEYS[tab])}
      columns={model.columns}
      getRowId={(row) => row.id}
      controller={model.controller}
      data={pageTableData(model.query, model.controller.state.page, FLEET_PAGE_SIZE)}
      voidOf={(row) =>
        "voided_at" in row ? voidInfoOf(row, author, { formatWhen: format, reasonLabel }) : null
      }
    />
  );
}
export function FleetHistory(props: Props) {
  const { t } = useTranslation();
  const model = useHistoryModel(props);
  const { tab, actions } = props;
  return (
    <>
      <FleetFilters controller={model.controller} />
      {tab === "responsibility" && <p>{t("fleet.letter.scope")}</p>}
      {tab === "fuel" && model.query.data?.count === 0 && <p>{t("fleet.gap.insufficient")}</p>}
      {typeof model.source === "string" && (
        <p role="status">{t("fleet.history.reference", { id: model.source })}</p>
      )}
      <HistoryRows model={model} tab={tab} />
      {model.voiding && model.voiding.context === actions.scope.context && actions.canManage && (
        <FleetHistoryVoidDialog
          row={model.voiding.row}
          scope={actions.scope}
          onClose={model.close}
        />
      )}
    </>
  );
}
