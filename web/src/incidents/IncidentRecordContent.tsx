import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Refreshing } from "../ui/Refreshing";
import { IncidentReadError } from "./IncidentReadError";
import { IncidentWorkspace } from "./IncidentWorkspace";
import type { Incident } from "./incidents-query";
import type { useIncidentRecord } from "./use-incident-record";
import styles from "./incidents.module.css";

interface ContentProps {
  code: string;
  incident: Incident;
  record: ReturnType<typeof useIncidentRecord>;
}
export function IncidentRecordContent({ code, incident, record }: ContentProps) {
  const { t } = useTranslation();
  return (
    <section className={styles.page}>
      <Link to="/incidents" search={record.search}>
        {t("incidents.workspace.title")}
      </Link>
      <h1>
        {code} · {incident.type_snapshot?.label ?? t("incidents.workspace.unavailable")}
      </h1>
      {record.query.isFetching && <Refreshing />}
      {record.query.isError && (
        <IncidentReadError error={record.query.error} onRetry={record.retry} />
      )}
      <IncidentWorkspace {...record.workspace} incident={incident} />
    </section>
  );
}
