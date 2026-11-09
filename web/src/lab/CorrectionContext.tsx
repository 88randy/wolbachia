import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { voidContextOptions } from "./lab-query";
import type { Count, LabScope } from "./lab-query";
import { CorrectionForm } from "./CorrectionForm";
export function CorrectionContext(props: { scope: LabScope; count: Count; onClose: () => void; storageKey: string; onBusyChange: (busy: boolean) => void }) {
  const { t } = useTranslation();
  const query = useQuery(voidContextOptions(props.scope, props.count.id));
  if (query.isPending) return <CardSkeleton />;
  if (query.isError) return <ErrorState onRetry={() => { void query.refetch(); }} />;
  if (!query.data.is_current || query.data.blocked_by.length > 0) return <p>{t("lab.error.conflict")}</p>;
  return <CorrectionForm {...props} revision={query.data.current_revision} onSaved={props.onClose} onCancel={props.onClose} />;
}
