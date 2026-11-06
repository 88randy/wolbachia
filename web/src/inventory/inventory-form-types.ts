import type { InventoryRecord } from "./inventory-links";
import type { InventoryValues } from "./inventory-fields";
export interface InventoryFieldsProps {
  values: InventoryValues;
  setValue: (name: string, value: string) => void;
  disabled: boolean;
  previous?: InventoryRecord;
}
