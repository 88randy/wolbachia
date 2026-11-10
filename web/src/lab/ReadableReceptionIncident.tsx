import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorState } from "../ui/ErrorState";
import { Skeleton } from "../ui/Skeleton";
import { useReceptionIncident } from "./use-reception-reference";

export function ReadableReceptionIncident({ id }: { id: string }) {
  const { t } = useTranslation();
  const query = useReceptionIncident(id);
  if (query.error) return <ErrorState onRetry={query.retry} />;
  if (!query.data) return <Skeleton />;
  return (
    <Link to="/incidents/$code" params={{ code: query.data.code }}>
      {t("labReception.action.openIncident")} · {query.data.code}
    </Link>
  );
}
