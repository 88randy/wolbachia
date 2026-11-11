import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { FormSection } from "../../components/templates/FormSection";
import { Combobox } from "../../ui/Combobox";
import { LineItemEditor } from "../line-items/LineItemEditor";
import type { LineChoice } from "../line-items/LineItemEditor";
import { LotAdder } from "./LotAdder";
import type { AssignmentDraft } from "./use-assignment-draft";

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

/** What each added lot shows: its name and the unit its quantity is counted in. */
function useChoices(lots: readonly Schemas["Lot"][]): LineChoice[] {
  const { t } = useTranslation();
  return lots.map((lot) => ({
    value: lot.id,
    label: `${lot.supply_version.label} · ${lot.code}`,
    unitText:
      lot.supply_version.unit === "piece" ? t("transfers.new.unit.piece") : lot.supply_version.unit,
  }));
}

/** The form of one delivery: where it leaves from, and which lots with how much of each. */
export function AssignmentDelivery(props: {
  draft: AssignmentDraft;
  lots: readonly Schemas["Lot"][] | undefined;
  origins: readonly Schemas["Location"][];
}) {
  const { t } = useTranslation();
  const { draft, origins } = props;
  const lots = props.lots ?? [];
  const choices = useChoices(lots);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <FormSection title={t("allocation.assignment.sectionOrigin")}>
        <OriginPicker draft={draft} origins={origins} />
      </FormSection>
      <FormSection
        title={t("allocation.assignment.sectionLots")}
        description={t("allocation.assignment.sectionLotsHint")}
      >
        <LotAdder lots={lots} draft={draft} />
        {draft.lines.length > 0 && (
          <LineItemEditor
            idPrefix="delivery-line"
            items={draft.lines}
            choices={choices}
            showAvailable={false}
            isLotFixed
            onChange={(key, patch) => {
              if (patch.quantity !== undefined) draft.setQuantity(key, patch.quantity);
            }}
            onRemove={draft.removeLine}
          />
        )}
      </FormSection>
    </div>
  );
}
