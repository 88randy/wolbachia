import { useTranslation } from "react-i18next";
import type { InventoryRecord } from "./inventory-links";
import { inventoryValuesOf } from "./inventory-form-values";
import { fieldKeys } from "./inventory-fields";
import { ProtocolFacts } from "./ProtocolFacts";
import { DescriptionGrid } from "../components/templates/DescriptionGrid";
import type { MessageKey } from "@wolbachia/i18n";
import { useInventoryContext } from "./use-inventory-context";
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
function useFactValue() {
  const { t } = useTranslation();
  return (name: string, value: string) => {
    if (value === "true" || value === "false")
      return t(value === "true" ? "inventory.option.yes" : "inventory.option.no");
    const option = ["kind", "identity_kind", "expiry_basis"].includes(name)
      ? enumKeys[value]
      : undefined;
    return option ? t(option) : value;
  };
}
/** Read access exposes returned facts even when configuration controls are unavailable. */
export function InventoryFacts({ record }: { record: InventoryRecord }) {
  const { t } = useTranslation();
  const custody =
    useInventoryContext().readContext.mode === "custody" && "supply_version" in record;
  const factValue = useFactValue();
  const values = Object.entries(inventoryValuesOf(record)).filter(
    ([key]) => fieldKeys[key] && !identities.has(key),
  );
  const items = [
    ...values.map(([name, value]) => ({
      label: t(fieldKeys[name] ?? "inventory.field.name"),
      value: factValue(name, value),
    })),
    ...("owner_label" in record
      ? [{ label: t("inventory.field.owner"), value: record.owner_label }]
      : []),
    ...("location_version" in record && record.location_version
      ? [{ label: t("inventory.field.location"), value: record.location_version.name }]
      : []),
  ];
  return (
    <>
      {custody && <p>{t("inventory.context.admissionPins")}</p>}
      <DescriptionGrid items={items} />
      {"protocol" in record && <ProtocolFacts protocol={record.protocol} />}
    </>
  );
}
