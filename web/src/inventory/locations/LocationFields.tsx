import { useTranslation } from "react-i18next";
import { InventoryTextField } from "../InventoryTextField";
import { InventorySelectField, YES_NO } from "../InventorySelectField";
import { InventoryOptionSelect } from "../InventoryOptionSelect";
import { inventoryFieldProps } from "../inventory-field-props";
import type { InventoryFieldsProps } from "../inventory-form-types";
import styles from "../inventory.module.css";
import { FormSection } from "../../components/templates/FormSection";
import { useCan } from "../../session/use-can";
import { useQuadrantName, NO_NAME } from "../../lookups/use-reference-names";
import { QUADRANT_NAME_PERMISSIONS } from "../../lookups/lookup-permissions";
import { MapPointPicker } from "../../map-picker/MapPointPicker";
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
      autoPickOnly
      empty={{ message: "inventory.option.noCenters" }}
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
  const can = useCan();
  const quadrantName = useQuadrantName(QUADRANT_NAME_PERMISSIONS.some((code) => can(code)));
  const saved =
    props.previous && "quadrant_code" in props.previous ? props.previous.quadrant_code : null;
  const known = saved ?? quadrantName(props.values["quadrant_id"]);
  return (
    <InventoryOptionSelect
      key={center}
      id="inventory-quadrant_id"
      currentLabel={known === NO_NAME ? t("inventory.option.quadrantSet") : known}
      label={t("inventory.field.quadrant")}
      request={{
        kind: "placements",
        action: "location.create",
        center: props.previous ? "" : center,
      }}
      value={props.values["quadrant_id"] ?? ""}
      disabled={props.disabled || Boolean(props.previous)}
      required
      waitingFor="inventory.option.pickCenterFirst"
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
      waitingFor="inventory.option.pickQuadrantFirst"
      empty={{ message: "inventory.option.noOwners" }}
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
/** The place is marked on the map; longitude/latitude are filled from the pin. */
function LocationPlace(props: InventoryFieldsProps) {
  const { t } = useTranslation();
  const longitude = Number(props.values["longitude"]);
  const latitude = Number(props.values["latitude"]);
  const hasValue =
    Boolean(props.values["longitude"]?.trim()) && Number.isFinite(longitude + latitude);
  return (
    <MapPointPicker
      label={t("inventory.field.place")}
      value={hasValue ? [longitude, latitude] : null}
      onChange={([lon = 0, lat = 0]) => {
        if (props.disabled) return;
        props.setValue("longitude", String(lon));
        props.setValue("latitude", String(lat));
      }}
    />
  );
}
export function LocationFields(props: InventoryFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <FormSection title={t("inventory.section.locationData")}>
        <div className={styles.fields}>
          <LocationIdentity {...props} />
          <LocationCenter {...props} />
          <LocationQuadrant {...props} />
          <LocationOwner {...props} />
          <InventorySelectField
            {...inventoryFieldProps(props, "is_insecticide_free")}
            options={YES_NO}
          />
        </div>
      </FormSection>
      <FormSection title={t("inventory.section.locationPlace")}>
        <LocationPlace {...props} />
      </FormSection>
    </>
  );
}
