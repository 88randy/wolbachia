import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Select } from "../../forms/Select";
import { DeliveredLines } from "./DeliveredLines";
import { DeliveryTable } from "./DeliveryTable";
import { ScanLotField } from "./ScanLotField";
import { compareDelivery } from "./delivery-compare";
import type { AssignmentDraft } from "./use-assignment-draft";
import type { Suggestion } from "./allocation-query";
import styles from "../inventory.module.css";

function OriginSelect({
  draft,
  origins,
}: {
  draft: AssignmentDraft;
  origins: readonly Schemas["Location"][];
}) {
  const { t } = useTranslation();
  const id = useId();
  const options = origins.map((origin) => ({
    value: origin.id,
    label: `${origin.code} · ${origin.name}`,
  }));
  return (
    <Select
      id={id}
      label={t("allocation.assignment.origin")}
      required
      value={draft.originId}
      options={[{ value: "", label: t("voiding.dialog.placeholder") }, ...options]}
      onChange={(event) => {
        draft.setOriginId(event.target.value);
      }}
    />
  );
}

/** Choose the origin, scan lots, edit delivered quantities and compare them with the suggestion. */
export function AssignmentDelivery(props: {
  draft: AssignmentDraft;
  suggestion: Suggestion | undefined;
  lots: readonly Schemas["Lot"][] | undefined;
  origins: readonly Schemas["Location"][];
}) {
  const { draft, suggestion, lots, origins } = props;
  const rows = compareDelivery(suggestion, draft.lines);
  return (
    <div className={styles.form}>
      <OriginSelect draft={draft} origins={origins} />
      <ScanLotField scan={draft.scan} onAdd={(code) => void draft.addLot(code)} />
      <DeliveredLines draft={draft} />
      {rows.length > 0 && <DeliveryTable rows={rows} lots={lots} />}
    </div>
  );
}
