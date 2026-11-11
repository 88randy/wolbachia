import { useTranslation } from "react-i18next";
import { InventoryTextField } from "../InventoryTextField";
import { InventoryOptionSelect } from "../InventoryOptionSelect";
import { inventoryFieldProps } from "../inventory-field-props";
import type { InventoryFieldsProps } from "../inventory-form-types";
import styles from "../inventory.module.css";
function LotSupplyChoice(props: InventoryFieldsProps) {
  const { t } = useTranslation();
  const previous =
    props.previous && "supply_version" in props.previous ? props.previous : undefined;
  return (
    <InventoryOptionSelect
      id="inventory-supply_id"
      label={t("inventory.field.supply")}
      request={{ kind: "supplies" }}
      value={props.values["supply_id"] ?? ""}
      currentLabel={previous?.supply_version.label}
      disabled={props.disabled || Boolean(previous)}
      required
      empty={{
        message: "inventory.option.noSupplies",
        action: { label: "inventory.option.createSupply", to: "/inventory/supplies" },
      }}
      onChange={(value) => {
        props.setValue("supply_id", value);
      }}
    />
  );
}
export function LotIdentityFields(props: InventoryFieldsProps) {
  const previous =
    props.previous && "supply_version" in props.previous ? props.previous : undefined;
  return (
    <div className={styles.fields}>
      <InventoryTextField
        {...inventoryFieldProps(props, "code")}
        required
        maxLength={50}
        disabled={props.disabled || Boolean(previous)}
      />
      <LotSupplyChoice {...props} />
      <InventoryTextField
        {...inventoryFieldProps(props, "quantity")}
        disabled={props.disabled || Boolean(previous?.admission_id)}
      />
      <InventoryTextField {...inventoryFieldProps(props, "provenance")} maxLength={2000} />
    </div>
  );
}
