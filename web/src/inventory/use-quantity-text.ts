import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import { formatInventoryQuantity } from "./format-inventory-quantity";

/** "4 piezas": the quantity without trailing zeros, with its unit when one is known. */
export function useQuantityText(): (quantity: string, unit?: string) => string {
  const { t } = useTranslation();
  const { language } = useLanguage();
  return (quantity, unit) => {
    const text = formatInventoryQuantity(quantity, language);
    if (!unit) return text;
    return `${text} ${unit === "piece" ? t("transfers.new.unit.piece") : unit}`;
  };
}
