import { ApiError } from "@wolbachia/api-client";
import { Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../shell/use-document-title";
import { ErrorState } from "../ui/ErrorState";
import { CardSkeleton } from "../ui/CardSkeleton";
import { Refreshing } from "../ui/Refreshing";
import { NotFoundState } from "../states/NotFoundState";
import { incidentDetailOptions } from "./incidents-query";
import { useIncidentScope } from "./use-incident-scope";
import { useIncidentCommands } from "./use-incident-commands";
import { IncidentWorkspace } from "./IncidentWorkspace";
import styles from "./incidents.module.css";
export function IncidentRecord({ code }: { code: string }) {
 const { t } = useTranslation();
 const scope = useIncidentScope();
 const search = useSearch({ strict: false });
 const query = useQuery(incidentDetailOptions(scope, code));
 const commands = useIncidentCommands(scope, query.data?.id ?? "");
 useDocumentTitle(code);
 if (query.isPending) return <CardSkeleton />;
 if (query.isError) return <ErrorState code={query.error instanceof ApiError ? query.error.code : undefined} onRetry={() => { void query.refetch(); }} />;
 if (!query.data) return <NotFoundState />;
 return <section className={styles.page}>
 <Link to="/incidents" search={search}>{t("incidents.workspace.title")}</Link>
 <h1>{code} · {query.data.type_snapshot?.label ?? t("incidents.workspace.unavailable")}</h1>
 {query.isFetching && <Refreshing />}
 <IncidentWorkspace scope={scope} incident={query.data} commands={commands} isFetching={query.isFetching} review={async () => { const result = await query.refetch(); if (result.isSuccess) commands.clearFailure(); }} />
 </section>;
}
