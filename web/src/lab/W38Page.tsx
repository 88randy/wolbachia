import { LabListScreen } from "./LabListScreen";
import { SHIPMENT_TABLE, shipmentOptions } from "./lab-lists";
import { useShipmentColumns } from "./use-lab-list-columns";

/** W38 UIEB shipments: the RFC column stays empty when the transfer is not authorized. */
export function W38Page() {
  const columns = useShipmentColumns();
  return (
    <LabListScreen
      titleKey="lab.shipments.title"
      descriptionKey="lab.shipments.description"
      table={SHIPMENT_TABLE}
      options={shipmentOptions}
      columns={columns}
      getRowId={(row) => row.id}
    />
  );
}
