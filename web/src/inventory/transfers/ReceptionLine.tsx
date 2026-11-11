import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { TextField } from "../../forms/TextField";
import { StatusPill } from "../../ui/StatusPill";
import { useLanguage } from "../../i18n/use-language";
import { nameOrDash } from "../../lookups/use-reference-names";
import { formatInventoryQuantity } from "../format-inventory-quantity";
import { receivedUnits } from "./transfer-reception";
import { quantityText } from "./transfer-quantities";
import type { TransferScope } from "./transfer-query";
import type { useTransferReception } from "./use-transfer-reception";
import { ReceptionMissingPhoto } from "./ReceptionMissingPhoto";
export interface ReceptionLineProps {
  line: Schemas["TransferLine"];
  model: ReturnType<typeof useTransferReception>;
  scope: TransferScope;
  transfer?: Schemas["Transfer"];
  isBlocked?: boolean;
}

/** One lot of the shipment: what was expected, what arrived, and only the difference stands out. */
export function ReceptionLine(props: ReceptionLineProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { line, model } = props;
  const received = quantityText(receivedUnits(model.draft, line.id));
  const missing = model.missing.find((entry) => entry.line_id === line.id);
  const format = (value: string) => formatInventoryQuantity(value, language);
  return (
    <li
      className={`flex min-w-0 flex-col gap-3 rounded-xl border p-4 ${missing ? "border-warning-fg bg-warning-bg" : "border-line bg-surface"}`}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,10rem)] items-end gap-x-5 gap-y-2">
        <div className="min-w-0">
          <p className="m-0 text-sm font-semibold text-ink">{nameOrDash(line.lot_code)}</p>
          <p className="m-0 text-[13px] text-ink-2">
            {t("transfers.receive.expected", { quantity: format(line.quantity) })}
          </p>
        </div>
        <TextField
          id={`received-${line.id}`}
          label={t("transfers.receive.received")}
          inputMode="decimal"
          value={received}
          disabled={props.isBlocked}
          onChange={(event) => {
            if (props.transfer) model.setReceived(props.transfer, line.id, event.target.value);
          }}
        />
      </div>
      {missing && (
        <StatusPill tone="warning">
          <TriangleAlert aria-hidden="true" />
          {t("transfers.receive.missing", { quantity: format(missing.quantity) })}
        </StatusPill>
      )}
      <ReceptionMissingPhoto {...props} />
    </li>
  );
}
