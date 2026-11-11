import { useTranslation } from "react-i18next";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { NotFoundState } from "../../states/NotFoundState";
import { DetailPage } from "../../components/templates/DetailPage";
import { StatusPill } from "../../ui/StatusPill";
import { DiscrepancyFacts } from "./DiscrepancyFacts";
import { DiscrepancyHistory } from "./DiscrepancyHistory";
import { DiscrepancyResolveForm } from "./DiscrepancyResolveForm";
import { DiscrepancyCommandNotice } from "./DiscrepancyCommandNotice";
import { useDiscrepancyRecord } from "./discrepancy-use-record";
import { discrepancyFolio } from "./discrepancy-labels";
import { isDiscrepancyDenied } from "./discrepancy-query";
import type { Discrepancy } from "./discrepancy-query";

export function DiscrepancyRecord({ code }: { code: string }) {
  const { t } = useTranslation();
  const state = useDiscrepancyRecord(code);
  if (isDiscrepancyDenied(state.query.error)) return <NotFoundState />;
  if (state.query.isPending || state.query.isPlaceholderData) return <CardSkeleton />;
  if (state.query.isError)
    return (
      <ErrorState
        message={t("discrepancies.page.readError")}
        onRetry={() => {
          void state.refresh();
        }}
      />
    );
  if (!state.record) return <NotFoundState />;
  return <DiscrepancyDetail state={state} record={state.record} />;
}
function DiscrepancyDetail({
  state,
  record,
}: {
  state: ReturnType<typeof useDiscrepancyRecord>;
  record: Discrepancy;
}) {
  const { t } = useTranslation();
  return (
    <DetailPage
      title={discrepancyFolio(record.code)}
      status={
        <StatusPill tone={record.status === "open" ? "warning" : "success"}>
          {t(`discrepancies.status.${record.status}`)}
        </StatusPill>
      }
      subtitle={t("discrepancies.record.subtitle", { transfer: record.transfer.code })}
      back={{ label: t("discrepancies.actions.back"), link: { to: "/inventory/discrepancies" } }}
    >
      {state.canClose && record.status === "open" && <DiscrepancyResolveForm state={state} />}
      <DiscrepancyFacts record={record} />
      <DiscrepancyHistory record={record} />
      <DiscrepancyCommandNotice state={state} />
    </DetailPage>
  );
}
