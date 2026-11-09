import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import type { Incident } from "./incidents-query";
import { IncidentBlockerItem } from "./IncidentBlockerItem";

export function IncidentBlockers({ blockers }: Pick<Incident, "blockers">) {
  const { t } = useTranslation();
  return (
    <Card title={t("incidents.workspace.blocks")}>
      {blockers.length ? (
        <ul>
          {blockers.map((blocker) => (
            <IncidentBlockerItem key={blocker.id} blocker={blocker} />
          ))}
        </ul>
      ) : (
        <p>{t("incidents.workspace.noBlocks")}</p>
      )}
    </Card>
  );
}
