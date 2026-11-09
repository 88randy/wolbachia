import { useTranslation } from "react-i18next";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { NotFoundState } from "../../states/NotFoundState";
import { tableErrorKey } from "../../data-table/table-error";
import type { RelocationScope } from "./relocations-query";
import { useRelocationRecord } from "./use-relocation-record";
import { RelocationDecisionContent } from "./RelocationDecisionContent";
export interface RelocationDecisionProps {
  scope: RelocationScope;
  code: string;
  reason: string;
  onReasonChange: (reason: string) => void;
}
export function RelocationDecision(props: RelocationDecisionProps) {
  const { t } = useTranslation();
  const form = useRelocationRecord(props);
  if (form.query.isPending || form.query.isPlaceholderData) return <CardSkeleton />;
  if (form.query.isError)
    return (
      <ErrorState
        message={t(tableErrorKey(form.query.error))}
        onRetry={() => {
          void form.query.refetch();
        }}
      />
    );
  const proposal = form.query.data;
  if (!proposal || proposal.code !== props.code) return <NotFoundState />;
  return <RelocationDecisionContent {...props} proposal={proposal} form={form} />;
}
