import { useLanguage } from "../i18n/use-language";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { ErrorState } from "../ui/ErrorState";
import { Skeleton } from "../ui/Skeleton";
import { incidentListOptions } from "./incidents-query";
import type { IncidentQuery, IncidentScope } from "./incidents-query";
export function IncidentCountLink({ scope, label, filters }: { scope: IncidentScope; label: MessageKey; filters: IncidentQuery }) {
 const { t } = useTranslation();
 const { language } = useLanguage();
 const query = useQuery(incidentListOptions(scope, { ...filters, page_size: 1 }));
 if (query.isError) return <ErrorState onRetry={() => { void query.refetch(); }} />;
 return <Link to="/incidents" search={Object.fromEntries(Object.entries(filters).filter(([,value]) => value !== undefined).map(([key,value]) => [key,String(value)]))}>
 {t(label)} {query.data ? query.data.count.toLocaleString(language) : <Skeleton />}
 </Link>;
}
