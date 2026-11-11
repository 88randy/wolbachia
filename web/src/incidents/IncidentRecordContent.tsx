import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DetailPage } from "../components/templates/DetailPage";
import { buttonVariants } from "../ui/button-variants";
import { Refreshing } from "../ui/Refreshing";
import { IncidentReadError } from "./IncidentReadError";
import { IncidentWorkspace } from "./IncidentWorkspace";
import type { Incident } from "./incidents-query";
import type { useIncidentRecord } from "./use-incident-record";

interface ContentProps {
  code: string;
  incident: Incident;
  record: ReturnType<typeof useIncidentRecord>;
}
export function IncidentRecordContent({ code, incident, record }: ContentProps) {
  const { t } = useTranslation();
  return (
    <DetailPage
      code={code}
      centerId={incident.center}
      title={incident.type_snapshot?.label ?? t("incidents.workspace.unavailable")}
      actions={
        <Link
          to="/incidents"
          search={record.search}
          className={buttonVariants({ variant: "tertiary" })}
        >
          <ArrowLeft aria-hidden="true" />
          {t("incidents.workspace.title")}
        </Link>
      }
      notices={
        <>
          {record.query.isFetching && <Refreshing />}
          {record.query.isError && (
            <IncidentReadError error={record.query.error} onRetry={record.retry} />
          )}
        </>
      }
    >
      <IncidentWorkspace {...record.workspace} incident={incident} />
    </DetailPage>
  );
}
