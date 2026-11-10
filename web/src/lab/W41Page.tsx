import { LabListScreen } from "./LabListScreen";
import { MATERIAL_TABLE, materialOptions } from "./lab-lists";
import { useMaterialColumns } from "./use-lab-list-columns";

/** W41 Third-party material requests: delivery is blocked until the CENAPRECE notice exists. */
export function W41Page() {
  const columns = useMaterialColumns();
  return (
    <LabListScreen
      titleKey="lab.materials.title"
      descriptionKey="lab.materials.description"
      table={MATERIAL_TABLE}
      options={materialOptions}
      columns={columns}
      getRowId={(row) => row.id}
    />
  );
}
