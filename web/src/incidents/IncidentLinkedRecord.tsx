import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useCan } from "../session/use-can";
export function IncidentLinkedRecord({ record }: { record: Schemas["IncidentLinkedRecord"] }) {
  const { t } = useTranslation();
  const can = useCan();
  if (!record.available || !record.code) return <span>{t("incidents.workspace.unavailable")}</span>;
  const label = `${record.code}${record.is_voided ? ` · ${t("incidents.state.voided")}` : ""}`;
  if (record.kind === "motorcycle")
    return (
      <Link to="/fleet/motorcycles/$code" params={{ code: record.code }}>
        {label}
      </Link>
    );
  if (record.kind === "lot")
    return (
      <Link to="/inventory/lots/$code" params={{ code: record.code }}>
        {label}
      </Link>
    );
  if (record.kind === "bag" && can("bag.receive"))
    return (
      <Link to="/lab/bags" search={{ code: record.code, view: "discrepancies" }}>
        {label}
      </Link>
    );
  return <span>{label}</span>;
}
