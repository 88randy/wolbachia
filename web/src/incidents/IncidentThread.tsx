import { incidentEventKey } from "./incident-labels";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Card } from "../ui/Card";
import { useFormatDateTime } from "../format/use-format-date-time";
import { nameOrDash } from "../lookups/use-reference-names";
import styles from "./incidents.module.css";
/** Complete immutable thread, reusable by the universal record when W4 lands. */
export function IncidentThread({ events }: { events: readonly Schemas["IncidentEvent"][] }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <Card title={t("incidents.workspace.thread")}>
      {!events.length && <p>{t("incidents.workspace.noEvents")}</p>}
      <ol className={styles.thread}>
        {events.map((event) => (
          <li key={event.id}>
            <strong>{t(incidentEventKey(event.action))}</strong>
            <p>{event.text}</p>
            <p>
              {event.author_display ?? t("incidents.workspace.system")} ·{" "}
              <time dateTime={event.created_at}>{format(event.created_at)}</time>
            </p>
            <p>
              {t("incidents.workspace.eventStateNamed", {
                owner: nameOrDash(event.owner_display),
                severity: t(`incidents.severity.${event.severity}`),
                state: t(`incidents.state.${event.state}`),
              })}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
