import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useFormatDateTime } from "../format/use-format-date-time";
import { useCan } from "../session/use-can";
import { useSessionIdentity } from "../session/use-session-identity";
import { Button } from "../ui/Button";
import { useVoidReasonLabel } from "../void";
import { ActivityTotals } from "./ActivityTotals";
import { activityVoidInfo } from "./activity-void";
import {
  activitiesOptions,
  COMMUNITY_PAGE_SIZE,
  COMMUNITY_TABLE,
  COMMUNITY_VOID,
} from "./community-query";
import type { CommunityActivity } from "./community-query";
import { useActivityColumns } from "./use-activity-columns";

const getActivityId = (row: CommunityActivity): string => row.id;

/** Totals, filter bar and the server-paged table of activities, with a Void row action. */
export function ActivitiesTable({ onVoid }: { onVoid: (row: CommunityActivity) => void }) {
  const { t } = useTranslation();
  const canVoid = useCan()(COMMUNITY_VOID);
  const controller = useTableUrlState(COMMUNITY_TABLE);
  const query = useQuery(activitiesOptions(useApiClient(), useSessionIdentity(), controller.state));
  const formatWhen = useFormatDateTime();
  const reasonLabel = useVoidReasonLabel();
  const author = () => t("community.author.unknown");
  return (
    <>
      <ActivityTotals totals={query.data?.totals} />
      <FilterBar controller={controller} />
      <DataTable
        caption={t("community.caption")}
        columns={useActivityColumns()}
        getRowId={getActivityId}
        controller={controller}
        data={pageTableData(query, controller.state.page, COMMUNITY_PAGE_SIZE)}
        voidOf={(row) => activityVoidInfo(row, { author, formatWhen, reasonLabel })}
        rowActions={(row) =>
          row.is_voided ? null : (
            <Button
              variant="tertiary"
              size="sm"
              disabled={!canVoid}
              title={canVoid ? undefined : t("community.void.noPermission")}
              onClick={() => {
                onVoid(row);
              }}
            >
              {t("community.void.action")}
            </Button>
          )
        }
      />
    </>
  );
}
