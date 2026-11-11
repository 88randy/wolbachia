import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../../forms/TextField";
import { Button } from "../../../ui/Button";
import { Combobox } from "../../../ui/Combobox";
import { formatInventoryQuantity } from "../../format-inventory-quantity";
import { useLanguage } from "../../../i18n/use-language";
import type { DraftLine, StockChoice } from "./transfer-draft";

/** One lot of the shipment: which lot (with what is there), and how much of it goes. */
export function TransferLineRow(props: {
  line: DraftLine;
  index: number;
  choices: ReadonlyMap<string, StockChoice>;
  isDisabled: boolean;
  onChange: (next: Partial<DraftLine>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { line, index, choices } = props;
  const chosen = choices.get(line.lotId);
  const unit = chosen?.unit === "piece" ? t("transfers.new.unit.piece") : (chosen?.unit ?? "");
  const options = [...choices.values()].map((choice) => ({
    value: choice.lotId,
    label: `${choice.supplyLabel} · ${choice.lotCode}`,
    detail: `${formatInventoryQuantity(choice.available, language)} ${choice.unit === "piece" ? t("transfers.new.unit.piece") : choice.unit}`,
  }));
  const id = `transfer-line-${String(index)}`;
  return (
    <li className="grid min-w-0 grid-cols-1 items-end gap-x-5 gap-y-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={`${id}-lot`} className="text-xs font-bold text-ink">
          {t("transfers.new.item.lot")}
        </label>
        <Combobox
          id={`${id}-lot`}
          value={line.lotId}
          options={options}
          placeholder={t("inventory.option.choose")}
          disabled={props.isDisabled}
          emptyMessage={t("transfers.new.noStock")}
          onValueChange={(lotId) => {
            props.onChange({ lotId });
          }}
        />
      </div>
      <TextField
        id={`${id}-quantity`}
        label={t("transfers.new.item.quantity")}
        inputMode="decimal"
        value={line.quantity}
        disabled={props.isDisabled || !chosen}
        hint={
          chosen
            ? t("transfers.new.item.available", {
                quantity: formatInventoryQuantity(chosen.available, language),
                unit,
              })
            : undefined
        }
        onChange={(event) => {
          props.onChange({ quantity: event.target.value });
        }}
      />
      <Button
        variant="ghost"
        aria-label={t("transfers.new.item.remove", { number: index + 1 })}
        leadingIcon={<X aria-hidden="true" />}
        onClick={props.onRemove}
      />
    </li>
  );
}
