import { useTranslation } from "react-i18next";
import { InventoryTextField } from "../InventoryTextField";
import { InventorySelectField, YES_NO } from "../InventorySelectField";
import { InventoryOptionSelect } from "../InventoryOptionSelect";
import { inventoryFieldProps } from "../inventory-field-props";
import type { InventoryFieldsProps } from "../inventory-form-types";
import styles from "../inventory.module.css";
function LocationCenter(props: InventoryFieldsProps) {
  const { t } = useTranslation();
  return (
    <InventoryOptionSelect
      id="inventory-center_id"
      label={t("inventory.field.center")}
      request={{ kind: "centers" }}
      value={props.values["center_id"] ?? ""}
      disabled={props.disabled || Boolean(props.previous)}
      required
      onChange={(value) => {
        props.setValue("center_id", value);
        props.setValue("quadrant_id", "");
        props.setValue("owner_id", "");
      }}
    />
  );
}
function LocationQuadrant(props: InventoryFieldsProps) {
  const { t } = useTranslation();
  const center = props.values["center_id"] ?? "";
  return (
    <InventoryOptionSelect
      key={center}
      id="inventory-quadrant_id"
      label={t("inventory.field.quadrant")}
      request={{
        kind: "placements",
        action: "location.create",
        center: props.previous ? "" : center,
      }}
      value={props.values["quadrant_id"] ?? ""}
      disabled={props.disabled || Boolean(props.previous)}
      required
      onChange={(value) => {
        props.setValue("quadrant_id", value);
        props.setValue("owner_id", "");
      }}
    />
  );
}
function LocationOwner(props: InventoryFieldsProps) {
  const { t } = useTranslation();
  const previous = props.previous && "geometry" in props.previous ? props.previous : undefined;
  const center = props.values["center_id"] ?? "";
  const quadrant = props.values["quadrant_id"] ?? "";
  const request = previous
    ? { kind: "owners" as const, location: previous.id }
    : { kind: "owners" as const, center, quadrant };
  return (
    <InventoryOptionSelect
      key={center + ":" + quadrant}
      id="inventory-owner_id"
      label={t("inventory.field.owner")}
      request={request}
      value={props.values["owner_id"] ?? ""}
      currentLabel={previous?.owner_label}
      disabled={props.disabled}
      required
      onChange={(value) => {
        props.setValue("owner_id", value);
      }}
    />
  );
}
function LocationIdentity(props: InventoryFieldsProps) {
  const field = (name: string) => inventoryFieldProps(props, name);
  return (
    <>
      <InventoryTextField
        {...field("code")}
        required
        maxLength={50}
        disabled={props.disabled || Boolean(props.previous)}
      />
      <InventoryTextField {...field("name")} required maxLength={200} />
      <InventorySelectField
        {...field("kind")}
        required
        options={[
          ["biofactory", "inventory.option.biofactory"],
          ["warehouse", "inventory.option.warehouse"],
          ["center", "inventory.option.center"],
        ]}
      />
    </>
  );
}
export function LocationFields(props: InventoryFieldsProps) {
  return (
    <div className={styles.fields}>
      <LocationIdentity {...props} />
      <LocationCenter {...props} />
      <LocationQuadrant {...props} />
      <LocationOwner {...props} />
      {["longitude", "latitude"].map((name) => (
        <InventoryTextField key={name} {...inventoryFieldProps(props, name)} required />
      ))}
      <InventorySelectField
        {...inventoryFieldProps(props, "is_insecticide_free")}
        options={YES_NO}
      />
    </div>
  );
}
