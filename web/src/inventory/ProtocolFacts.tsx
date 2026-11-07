import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { protocolValuesOf } from "./inventory-protocol";
import { fieldKeys } from "./inventory-fields";
import { minuteText } from "./inventory-form-values";
import styles from "./inventory.module.css";
type Protocol = Schemas["Protocol"];
const scalarFields = [
  "name",
  "shelf_life_seconds",
  "expiry_basis",
  "temperature_min",
  "temperature_max",
  "humidity_min",
  "humidity_max",
] as const;
function ProtocolArrays({ protocol }: { protocol: Protocol }) {
  const { t } = useTranslation();
  const parsed = protocolValuesOf(protocol);
  if (!parsed)
    return (
      <div>
        <dt>{t("inventory.section.options")}</dt>
        <dd>{t("inventory.state.unavailable")}</dd>
      </div>
    );
  const windows = parsed.reading_windows
    .map(([start, end]) => minuteText(start) + "–" + minuteText(end))
    .join(", ");
  const required = parsed.required_fields
    .map((key) => t(fieldKeys[key] ?? "inventory.field.name"))
    .join(", ");
  return (
    <>
      <div>
        <dt>{t("inventory.section.options")}</dt>
        <dd>{windows || t("inventory.state.unconfigured")}</dd>
      </div>
      <div>
        <dt>{t("inventory.section.biology")}</dt>
        <dd>{required || t("inventory.state.unconfigured")}</dd>
      </div>
    </>
  );
}
export function ProtocolFacts({ protocol }: { protocol: Protocol | null }) {
  const { t } = useTranslation();
  if (!protocol) return <p>{t("inventory.state.unconfigured")}</p>;
  return (
    <dl className={styles.summary}>
      {scalarFields.map((field) => (
        <ScalarProtocolFact key={field} field={field} protocol={protocol} />
      ))}
      <div>
        <dt>{t("inventory.field.incidentType")}</dt>
        <dd>{protocol.incident_type?.label ?? t("inventory.state.unconfigured")}</dd>
      </div>
      <ProtocolArrays protocol={protocol} />
    </dl>
  );
}
function ScalarProtocolFact({
  field,
  protocol,
}: {
  field: (typeof scalarFields)[number];
  protocol: Protocol;
}) {
  const { t } = useTranslation();
  const value =
    field === "expiry_basis" && protocol.expiry_basis === "laid_on"
      ? t("inventory.field.laidOn")
      : String(protocol[field] ?? "") || t("inventory.state.unconfigured");
  return (
    <div>
      <dt>{t(fieldKeys[field === "name" ? "protocol_name" : field] ?? "inventory.field.name")}</dt>
      <dd>{value}</dd>
    </div>
  );
}
