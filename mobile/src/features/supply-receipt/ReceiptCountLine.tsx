import { useT } from "../../i18n/I18nProvider.tsx";
import { Counter } from "../../ui/Counter.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { plainQuantity } from "./plain-quantity.ts";
import type { ReceiptDraft } from "./receipt-types.ts";

interface Props {
  readonly line: ReceiptDraft["lines"][number];
  readonly name: string | null;
  readonly number: number;
  readonly isLocked: boolean;
  readonly onChange: (value: string) => void;
}

/** One supply of the delivery: big plus/minus for whole numbers, a decimal field otherwise. */
export function ReceiptCountLine({ line, name, number, isLocked, onChange }: Props) {
  const t = useT();
  const expected = plainQuantity(line.expected);
  const label = name
    ? t("field.receipt.supplyNamed", { name, expected })
    : t("field.receipt.supply", { number, expected });
  const current = Number(line.quantity);
  return Number.isInteger(Number(line.expected)) && Number.isInteger(current) ? (
    <Counter
      label={label}
      value={current}
      max={line.pieceId === null ? Number(line.expected) : 1}
      onChange={(value) => {
        if (!isLocked) onChange(String(value));
      }}
    />
  ) : (
    <ShiftField
      label={label}
      value={line.quantity}
      decimal
      disabled={isLocked}
      onChange={onChange}
    />
  );
}
