import { useTranslation } from "react-i18next";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { NotFoundState } from "../../states/NotFoundState";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { DetailPage } from "../../components/templates/DetailPage";
import { StatusPill } from "../../ui/StatusPill";
import { DiscrepancyFacts } from "./DiscrepancyFacts";
import { DiscrepancyHistory } from "./DiscrepancyHistory";
import { DiscrepancyResolveForm } from "./DiscrepancyResolveForm";
import { DiscrepancyCommandNotice } from "./DiscrepancyCommandNotice";
import { useDiscrepancyRecord } from "./discrepancy-use-record";
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
function DiscrepancyBack() {
  const { t } = useTranslation();
  return (
    <Link
      to="/inventory/discrepancies"
      className="inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-action"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {t("discrepancies.actions.back")}
    </Link>
  );
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
      title={record.code}
      status={
        <StatusPill tone={record.status === "open" ? "warning" : "success"}>
          {t(`discrepancies.status.${record.status}`)}
        </StatusPill>
      }
      actions={<DiscrepancyBack />}
    >
      <DiscrepancyFacts record={record} />
      <DiscrepancyHistory record={record} />
      {state.canClose && record.status === "open" && <DiscrepancyResolveForm state={state} />}
      <DiscrepancyCommandNotice state={state} />
    </DetailPage>
  );
}
