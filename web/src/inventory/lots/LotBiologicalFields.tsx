import { InventoryTextField } from "../InventoryTextField";
import type { InventoryFieldsProps } from "../inventory-form-types";
import styles from "../inventory.module.css";
export function LotBiologicalFields(props: InventoryFieldsProps) {
  return (
    <div className={styles.fields}>
      {[
        "species",
        "strain",
        "generation",
        "laid_on",
        "estimated_organism_count",
        "observations",
      ].map((name) => (
        <InventoryTextField
          key={name}
          name={name}
          type={name === "laid_on" ? "date" : "text"}
          value={props.values[name] ?? ""}
          onChange={(value) => {
            props.setValue(name, value);
          }}
          disabled={props.disabled}
        />
      ))}
    </div>
  );
}
