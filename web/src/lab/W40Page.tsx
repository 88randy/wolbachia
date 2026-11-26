import { LabListScreen } from "./LabListScreen";
import { SampleRowActions } from "./LabRowActions";
import { SAMPLE_TABLE, sampleOptions } from "./lab-lists";
import { useSampleColumns } from "./use-lab-list-columns";
import { useSampleDetail } from "./use-lab-details";

/** W40 Wolbachia results: receive samples and record attempts; an invalid one is repeated. */
export function W40Page() {
  return (
    <LabListScreen
      titleKey="lab.results.title"
      descriptionKey="lab.results.description"
      table={SAMPLE_TABLE}
      options={sampleOptions}
      columns={useSampleColumns()}
      getRowId={(row) => row.id}
      detailOf={useSampleDetail()}
      rowActions={(row) => <SampleRowActions sample={row} />}
    />
  );
}
