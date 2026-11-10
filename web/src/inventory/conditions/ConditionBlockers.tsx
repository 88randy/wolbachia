import type { Schemas } from "@wolbachia/api-client";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { blockerKeys } from "../inventory-fields";
export function ConditionBlockers({ status }: { status: Schemas["ConditionStatus"] }) {
  const { t } = useTranslation();
  return (
    <>
      {status.blocked_by.map((reason) => (
        <p key={reason}>{t(blockerKeys[reason] ?? "inventory.blocker.unknown")}</p>
      ))}
      {status.blocking_incidents.map((incident) => (
        <Link key={incident.id} to="/incidents/$code" params={{ code: incident.code }}>
          {incident.code}
        </Link>
      ))}
      {status.blocked_by.includes("condition_breach") && <p>{t("conditions.state.hold")}</p>}
    </>
  );
}
