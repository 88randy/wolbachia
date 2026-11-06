import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { InlineNotice } from "../../ui/InlineNotice";
import { Button } from "../../ui/Button";
import { InventoryTextField } from "../InventoryTextField";
import { InventorySelectField } from "../InventorySelectField";
import { InventoryOptionSelect } from "../InventoryOptionSelect";
import { biologicalFields, protocolValuesOf } from "../inventory-protocol";
import { inventoryFieldProps } from "../inventory-field-props";
import { fieldKeys, PROTOCOL_FIELDS, isProtocolField } from "../inventory-fields";
import { inventoryValuesOf, dirtyInventoryValues } from "../inventory-form-values";
import type { InventoryFieldsProps } from "../inventory-form-types";
import styles from "../inventory.module.css";
const fields = [
  "protocol_name",
  "shelf_life_seconds",
  "temperature_min",
  "temperature_max",
  "humidity_min",
  "humidity_max",
  "window1_start",
  "window1_end",
  "window2_start",
  "window2_end",
];
function ProtocolFields(props: InventoryFieldsProps) {
  return (
    <div className={styles.fields}>
      <InventorySelectField
        {...inventoryFieldProps(props, "expiry_basis")}
        options={[["laid_on", "inventory.field.laidOn"]]}
      />
      {fields.map((name) => (
        <InventoryTextField key={name} {...inventoryFieldProps(props, name)} />
      ))}
      <IncidentChoice {...props} />
    </div>
  );
}
function IncidentChoice(props: InventoryFieldsProps) {
  const { t } = useTranslation();
  const previous = props.previous && "protocol" in props.previous ? props.previous : undefined;
  const request = { kind: "protocols" as const, ...(previous ? { supply: previous.id } : {}) };
  return (
    <InventoryOptionSelect
      key={previous?.id ?? "new"}
      id="inventory-incident_type_id"
      label={t("inventory.field.incidentType")}
      request={request}
      value={props.values["incident_type_id"] ?? ""}
      currentLabel={previous?.protocol?.incident_type?.label}
      disabled={props.disabled}
      onChange={(value) => {
        props.setValue("incident_type_id", value);
      }}
    />
  );
}
function RequiredFields(props: InventoryFieldsProps) {
  const { t } = useTranslation();
  const selected = props.values["required_fields"]?.split(",").filter(Boolean) ?? [];
  const change = (name: string, checked: boolean) => {
    props.setValue(
      "required_fields",
      (checked ? [...selected, name] : selected.filter((item) => item !== name)).join(","),
    );
  };
  return (
    <fieldset disabled={props.disabled}>
      <legend>{t("inventory.section.biology")}</legend>
      {biologicalFields.map((name) => (
        <label key={name}>
          <input
            type="checkbox"
            checked={selected.includes(name)}
            onChange={(event) => {
              change(name, event.target.checked);
            }}
          />
          {t(fieldKeys[name] ?? "inventory.field.name")}
        </label>
      ))}
    </fieldset>
  );
}
export function SupplyProtocolFields(props: InventoryFieldsProps) {
  const { t } = useTranslation();
  const previous = props.previous && "protocol" in props.previous ? props.previous : undefined;
  const unreadable = Boolean(previous?.protocol && !protocolValuesOf(previous.protocol));
  const fieldsProps = { ...props, disabled: props.disabled || unreadable };
  const edited = Object.keys(dirtyInventoryValues(props.values, previous)).some(isProtocolField);
  return (
    <Card title={t("inventory.section.protocol")}>
      {unreadable && <InlineNotice tone="warning">{t("inventory.state.unavailable")}</InlineNotice>}
      {unreadable && edited && <DiscardProtocolEdits {...props} />}
      <ProtocolFields {...fieldsProps} />
      <RequiredFields {...fieldsProps} />
    </Card>
  );
}
function DiscardProtocolEdits(props: InventoryFieldsProps) {
  const { t } = useTranslation();
  const discard = () => {
    const baseline = inventoryValuesOf(props.previous);
    for (const field of PROTOCOL_FIELDS) props.setValue(field, baseline[field] ?? "");
  };
  return (
    <Button variant="secondary" disabled={props.disabled} onClick={discard}>
      {t("inventory.action.discardProtocol")}
    </Button>
  );
}
