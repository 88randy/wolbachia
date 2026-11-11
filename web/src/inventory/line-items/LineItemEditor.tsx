import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { TextField } from "../../forms/TextField";
import { Button } from "../../ui/Button";
import { Combobox } from "../../ui/Combobox";
import type { ComboboxOption } from "../../ui/Combobox";

export interface LineItem {
  /** Stable React key of the row. */
  key: string;
  /** The chosen lot (empty until chosen). */
  lotId: string;
  quantity: string;
}

/** What the editor needs to know about a lot: how much there is and in which unit. */
export interface LineChoice extends ComboboxOption {
  /** Already formatted, e.g. "400 piezas". */
  availableText?: string;
  unitText: string;
}

interface Props {
  idPrefix: string;
  items: readonly LineItem[];
  choices: readonly LineChoice[];
  /** Hide the "Disponible" column (deliveries and receiving have no stock to show). */
  showAvailable?: boolean;
  isDisabled?: boolean;
  /** Extra content under a row, e.g. the "photo of what is missing" field. */
  rowNote?: (item: LineItem) => ReactNode;
  emptyMessage?: ReactNode;
  onChange: (key: string, patch: Partial<LineItem>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}

/**
 * The one line-item editor of the inventory module: header labels once, then one row per lot on a
 * single baseline: Lote | Disponible | Cantidad (unit as suffix) | quitar.
 */
export function LineItemEditor(props: Props) {
  const { t } = useTranslation();
  const showAvailable = props.showAvailable ?? true;
  const columns = showAvailable
    ? "sm:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_2.5rem]"
    : "sm:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_2.5rem]";
  const header = "text-xs font-bold text-ink";
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className={`hidden items-end gap-x-4 sm:grid ${columns}`} aria-hidden="true">
        <span className={header}>{t("inventory.lineItems.lot")}</span>
        {showAvailable && <span className={header}>{t("inventory.lineItems.available")}</span>}
        <span className={header}>{t("inventory.lineItems.quantity")}</span>
        <span />
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {props.items.map((item, index) => {
          const choice = props.choices.find((option) => option.value === item.lotId);
          const id = `${props.idPrefix}-${String(index)}`;
          return (
            <li key={item.key} className="flex min-w-0 flex-col gap-2">
              <div className={`grid grid-cols-1 items-center gap-x-4 gap-y-2 ${columns}`}>
                <Combobox
                  id={`${id}-lot`}
                  value={item.lotId}
                  options={props.choices}
                  ariaLabel={t("inventory.lineItems.lotOf", { number: index + 1 })}
                  placeholder={t("inventory.option.choose")}
                  disabled={props.isDisabled}
                  emptyMessage={props.emptyMessage ?? t("inventory.lineItems.noLots")}
                  onValueChange={(lotId) => {
                    props.onChange(item.key, { lotId });
                  }}
                />
                {showAvailable && (
                  <span className="min-w-0 text-sm text-ink-2 tabular-nums">
                    {choice?.availableText ?? "—"}
                  </span>
                )}
                <div className="[&_label]:sr-only">
                  <TextField
                    id={`${id}-quantity`}
                    label={t("inventory.lineItems.quantityOf", { number: index + 1 })}
                    inputMode="decimal"
                    value={item.quantity}
                    disabled={props.isDisabled || !choice}
                    trailing={
                      choice ? (
                        <span className="pr-3 text-[13px] text-ink-2">{choice.unitText}</span>
                      ) : undefined
                    }
                    onChange={(event) => {
                      props.onChange(item.key, { quantity: event.target.value });
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  aria-label={t("inventory.lineItems.remove", { number: index + 1 })}
                  leadingIcon={<X aria-hidden="true" />}
                  disabled={props.isDisabled}
                  onClick={() => {
                    props.onRemove(item.key);
                  }}
                />
              </div>
              {props.rowNote?.(item)}
            </li>
          );
        })}
      </ul>
      <div>
        <Button
          variant="secondary"
          leadingIcon={<Plus aria-hidden="true" />}
          disabled={props.isDisabled}
          onClick={props.onAdd}
        >
          {t("inventory.lineItems.add")}
        </Button>
      </div>
    </div>
  );
}
