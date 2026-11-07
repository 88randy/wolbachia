import { InventoryTextField } from "../InventoryTextField";
import { InventorySelectField, YES_NO } from "../InventorySelectField";
import { inventoryFieldProps } from "../inventory-field-props";
import type { InventoryFieldsProps } from "../inventory-form-types";
import styles from "../inventory.module.css";
function SupplyFlags(props: InventoryFieldsProps) {
  return (
    <>
      {["is_chemical", "expiry_required", "requires_insecticide_free"].map((name) => (
        <InventorySelectField key={name} {...inventoryFieldProps(props, name)} options={YES_NO} />
      ))}
    </>
  );
}
export function SupplyIdentityFields(props: InventoryFieldsProps) {
  const field = (name: string) => inventoryFieldProps(props, name);
  return (
    <div className={styles.fields}>
      <InventoryTextField
        {...field("code")}
        required
        disabled={props.disabled || Boolean(props.previous)}
        maxLength={50}
      />
      <InventoryTextField {...field("label")} required maxLength={200} />
      <InventoryTextField {...field("unit")} required maxLength={24} />
      <InventorySelectField
        {...field("identity_kind")}
        required
        options={[
          ["piece", "inventory.option.piece"],
          ["lot", "inventory.option.lot"],
        ]}
      />
      <InventorySelectField {...field("is_biological")} required options={YES_NO} />
      <SupplyFlags {...props} />
      <InventoryTextField {...field("specification")} />
    </div>
  );
}
