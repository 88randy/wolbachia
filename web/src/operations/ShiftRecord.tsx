import { ApiError } from "@wolbachia/api-client";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { useDocumentTitle } from "../shell/use-document-title";
import { useCan } from "../session/use-can";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { Refreshing } from "../ui/Refreshing";
import { Button } from "../ui/Button";
import page from "../styles/page.module.css";
import { shiftOptions } from "./shifts-query";
import { ShiftSummary } from "./ShiftSummary";
import { ShiftTimeline } from "./ShiftTimeline";
import { ShiftHistory } from "./ShiftHistory";
import { ShiftActions } from "./ShiftActions";
export function ShiftRecord({ id }: { id: string }) {
  const { t } = useTranslation();
  useDocumentTitle(t("shift.page.title"));
  const client = useApiClient();
  const identity = useSessionIdentity();
  const query = useQuery(shiftOptions(client, identity, id));
  const can = useCan();
  const refresh = () => { void query.refetch(); };
  if (query.error instanceof ApiError && [403, 404].includes(query.error.status)) return <ErrorState onRetry={refresh} />;
  if (!query.data) return query.isError ? <ErrorState onRetry={refresh} /> : <CardSkeleton />;
  const { shift, readSequence } = query.data;
  const isReady = !query.isFetching && !query.isError && !query.isPlaceholderData && identity.isSettled;
  return (
    <section className={page.page}>
      <Link to="/operations/shifts">{t("shift.page.title")}</Link>
      <h1 className={page.title}>{t("shift.page.detail")}</h1>
      <Button variant="secondary" onClick={refresh}>{t("shift.action.refresh")}</Button>
      {query.isFetching && <Refreshing />}
      {query.isError && <ErrorState onRetry={refresh} />}
      <ShiftSummary shift={shift} />
      {can("shift.validate") && <ShiftActions shift={shift} isReady={isReady} readSequence={readSequence} />}
      <ShiftTimeline shift={shift} />
      <ShiftHistory decisions={shift.validation_timeline} />
    </section>
  );
}
