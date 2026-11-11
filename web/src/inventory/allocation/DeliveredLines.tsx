import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { TextField } from "../../forms/TextField";
import { Button } from "../../ui/Button";
import type { AssignmentDraft } from "./use-assignment-draft";

/** Quantity per added lot; removing only edits the draft, no record exists yet. */
export function DeliveredLines({
  draft,
  lots,
}: {
  draft: AssignmentDraft;
  lots: readonly Schemas["Lot"][];
}) {
  const { t } = useTranslation();
  if (draft.lines.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-4 p-0">
      {draft.lines.map((line) => {
        const material = lots.find((lot) => lot.id === line.lotId)?.supply_version.label;
        return (
          <li
            key={line.key}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,10rem)_auto] items-end gap-x-5"
          >
            <p className="m-0 min-w-0 pb-2 text-sm font-semibold text-ink [overflow-wrap:anywhere]">
              {material ? `${material} · ${line.lotCode}` : line.lotCode}
            </p>
            <TextField
              id={`delivered-${line.key}`}
              label={t("allocation.assignment.lineQuantityShort")}
              inputMode="decimal"
              value={line.quantity}
              onChange={(event) => {
                draft.setQuantity(line.key, event.target.value);
              }}
            />
            <Button
              variant="ghost"
              aria-label={t("allocation.assignment.removeLine", { code: line.lotCode })}
              leadingIcon={<X aria-hidden="true" />}
              onClick={() => {
                draft.removeLine(line.key);
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}
