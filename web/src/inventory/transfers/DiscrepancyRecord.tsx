import { useTranslation } from "react-i18next";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { NotFoundState } from "../../states/NotFoundState";
import { DiscrepancyFacts } from "./DiscrepancyFacts";
import { DiscrepancyHistory } from "./DiscrepancyHistory";
import { DiscrepancyResolveForm } from "./DiscrepancyResolveForm";
import { DiscrepancyCommandNotice } from "./DiscrepancyCommandNotice";
import { useDiscrepancyRecord } from "./discrepancy-use-record";
import { isDiscrepancyDenied } from "./discrepancy-query";
import styles from "../inventory.module.css";

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
  return (
    <section className={styles.content}>
      <DiscrepancyFacts record={state.record} />
      <DiscrepancyHistory record={state.record} />
      {state.canClose && state.record.status === "open" && <DiscrepancyResolveForm state={state} />}
      <DiscrepancyCommandNotice state={state} />
    </section>
  );
}
