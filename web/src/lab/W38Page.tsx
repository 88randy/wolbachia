import { LabListScreen } from "./LabListScreen";
import { SHIPMENT_TABLE, shipmentOptions } from "./lab-lists";
import { useShipmentColumns } from "./use-lab-list-columns";
import { useShipmentDetail } from "./use-lab-details";

/** W38 UIEB shipments: the RFC column stays empty when the transfer is not authorized. */
export function W38Page() {
  return (
    <LabListScreen
      titleKey="lab.shipments.title"
      descriptionKey="lab.shipments.description"
      table={SHIPMENT_TABLE}
      options={shipmentOptions}
      columns={useShipmentColumns()}
      getRowId={(row) => row.id}
      detailOf={useShipmentDetail()}
    />
  );
}
