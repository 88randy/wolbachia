import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { TypeSnapshot } from "./TypeSnapshot";
export function TypeHistoryRows({ versions }: { versions: Schemas["IncidentTypeHistory"][] }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <ol>
      {versions.map((version) => (
        <li key={version.current_version_id}>
          <h3>
            {t("incidentTypes.form.revision")} {version.revision}
          </h3>
          <TypeSnapshot item={version} />
          <time dateTime={version.created_at}>{format(version.created_at)}</time>
        </li>
      ))}
    </ol>
  );
}
