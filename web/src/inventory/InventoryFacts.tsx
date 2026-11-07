import { useTranslation } from "react-i18next";
import type { InventoryRecord } from "./inventory-links";
import { inventoryValuesOf } from "./inventory-form-values";
import { fieldKeys } from "./inventory-fields";
import { ProtocolFacts } from "./ProtocolFacts";
import styles from "./inventory.module.css";
import type { MessageKey } from "@wolbachia/i18n";
const enumKeys: Record<string, MessageKey> = {
  warehouse: "inventory.option.warehouse",
  biofactory: "inventory.option.biofactory",
  center: "inventory.option.center",
  piece: "inventory.option.piece",
  lot: "inventory.option.lot",
  laid_on: "inventory.field.laidOn",
};
const identities = new Set([
  "code",
  "supply_id",
  "center_id",
  "quadrant_id",
  "owner_id",
  "initial_location_id",
  "incident_type_id",
]);
function ScalarFact({ name, value }: { name: string; value: string }) {
  const { t } = useTranslation();
  const flag = value === "true" || value === "false";
  const option = ["kind", "identity_kind", "expiry_basis"].includes(name)
    ? enumKeys[value]
    : undefined;
  return (
    <div>
      <dt>{t(fieldKeys[name] ?? "inventory.field.name")}</dt>
      <dd>
        {flag
          ? t(value === "true" ? "inventory.option.yes" : "inventory.option.no")
          : option
            ? t(option)
            : value || t("inventory.state.unconfigured")}
      </dd>
    </div>
  );
}
/** Read access exposes returned facts even when configuration controls are unavailable. */
export function InventoryFacts({ record }: { record: InventoryRecord }) {
  const { t } = useTranslation();
  const values = Object.entries(inventoryValuesOf(record)).filter(
    ([key]) => fieldKeys[key] && !identities.has(key),
  );
  return (
    <>
      <dl className={styles.summary}>
        {values.map(([name, value]) => (
          <ScalarFact key={name} name={name} value={value} />
        ))}
      </dl>
      {"owner_label" in record && (
        <p>
          {t("inventory.field.owner")}: {record.owner_label}
        </p>
      )}
      {"location_version" in record && record.location_version && (
        <p>
          {record.location_version.code}: {record.location_version.name}
        </p>
      )}
      {"protocol" in record && <ProtocolFacts protocol={record.protocol} />}
    </>
  );
}
