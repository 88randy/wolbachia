import { useTranslation } from "react-i18next";
import { InventoryOptionSelect } from "../InventoryOptionSelect";
import { InventoryTextField } from "../InventoryTextField";
import { inventoryFieldProps } from "../inventory-field-props";
import type { InventoryFieldsProps } from "../inventory-form-types";
import styles from "../inventory.module.css";
import { placementQueryFor } from "../inventory-links";
function LotCenter(props: InventoryFieldsProps) {
  const { t } = useTranslation();
  return (
    <InventoryOptionSelect
      id="inventory-center_id"
      label={t("inventory.field.center")}
      request={{ kind: "centers" }}
      value={props.values["center_id"] ?? ""}
      disabled={props.disabled || Boolean(props.previous)}
      required
      autoPickOnly
      empty={{ message: "inventory.option.noCenters" }}
      onChange={(value) => {
        props.setValue("center_id", value);
        props.setValue("initial_location_id", "");
        props.setValue("initial_location_code", "");
      }}
    />
  );
}
function lotOf(props: InventoryFieldsProps) {
  return props.previous && "supply_version" in props.previous ? props.previous : undefined;
}
function destinationOf(props: InventoryFieldsProps) {
  const previous = lotOf(props);
  const center = props.values["center_id"] ?? "";
  const target = previous
    ? { kind: "lotUpdate" as const, lot: previous.id }
    : { kind: "lotCreate" as const, center };
  const request = { kind: "placements" as const, ...placementQueryFor(target) };
  return {
    key: previous ? previous.id : center,
    request,
    currentLabel: previous?.location_version?.name ?? props.values["initial_location_code"],
    disabled: props.disabled || Boolean(previous?.admission_id),
  };
}
function LotDestination(props: InventoryFieldsProps) {
  const { t } = useTranslation();
  const { key, ...choice } = destinationOf(props);
  return (
    <InventoryOptionSelect
      key={key}
      id="inventory-initial_location_id"
      label={t("inventory.field.location")}
      {...choice}
      waitingFor="inventory.option.pickCenterFirst"
      empty={{
        message: "inventory.option.noLocations",
        action: { label: "inventory.option.createLocation", to: "/inventory/locations" },
      }}
      value={props.values["initial_location_id"] ?? ""}
      onChange={(value) => {
        props.setValue("initial_location_id", value);
      }}
      onChoice={({ value, label }) => {
        props.setValue("initial_location_code", value === "none" ? "" : label);
      }}
    />
  );
}
export function LotPlacementFields(props: InventoryFieldsProps) {
  const previous = lotOf(props);
  return (
    <div className={styles.fields}>
      <LotCenter {...props} />
      <LotDestination {...props} />
      <InventoryTextField {...inventoryFieldProps(props, "expiry_date")} type="date" />
      {previous?.location_version && (
        <p>
          {previous.location_version.code}: {previous.location_version.name}
        </p>
      )}
    </div>
  );
}
