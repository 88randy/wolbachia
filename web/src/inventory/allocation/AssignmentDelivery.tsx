import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { FormSection } from "../../components/templates/FormSection";
import { Combobox } from "../../ui/Combobox";
import { DeliveredLines } from "./DeliveredLines";
import { DeliveryTable } from "./DeliveryTable";
import { LotPicker } from "./LotPicker";
import { ScanLotField } from "./ScanLotField";
import { compareDelivery } from "./delivery-compare";
import type { AssignmentDraft } from "./use-assignment-draft";
import type { Suggestion } from "./allocation-query";

function OriginPicker({
  draft,
  origins,
}: {
  draft: AssignmentDraft;
  origins: readonly Schemas["Location"][];
}) {
  const { t } = useTranslation();
  const options = origins.map((origin) => ({
    value: origin.id,
    label: origin.name,
    detail: origin.code,
  }));
  return (
    <div className="flex max-w-md min-w-0 flex-col gap-1.5">
      <label htmlFor="allocation-origin" className="text-xs font-bold text-ink">
        {t("allocation.assignment.origin")}
      </label>
      <Combobox
        id="allocation-origin"
        value={draft.originId}
        options={options}
        placeholder={t("allocation.assignment.originPlaceholder")}
        emptyMessage={t("inventory.option.noWarehouses")}
        onValueChange={draft.setOriginId}
      />
    </div>
  );
}

/** Choose the origin, add lots by name or scan, edit quantities and compare with the suggestion. */
export function AssignmentDelivery(props: {
  draft: AssignmentDraft;
  suggestion: Suggestion | undefined;
  lots: readonly Schemas["Lot"][] | undefined;
  origins: readonly Schemas["Location"][];
}) {
  const { t } = useTranslation();
  const { draft, suggestion, lots, origins } = props;
  const rows = compareDelivery(suggestion, draft.lines);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <FormSection title={t("allocation.assignment.sectionOrigin")}>
        <OriginPicker draft={draft} origins={origins} />
      </FormSection>
      <FormSection
        title={t("allocation.assignment.sectionLots")}
        description={t("allocation.assignment.sectionLotsHint")}
      >
        <LotPicker lots={lots ?? []} draft={draft} />
        <ScanLotField scan={draft.scan} onAdd={(code) => void draft.addLot(code)} />
        <DeliveredLines draft={draft} lots={lots ?? []} />
      </FormSection>
      {rows.length > 0 && <DeliveryTable rows={rows} lots={lots} />}
    </div>
  );
}
