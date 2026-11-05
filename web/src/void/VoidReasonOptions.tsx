import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import type { VoidReasonItem } from "./void-reasons-query";

/** Catalog order and translated labels belong to the organization, not to the form. */
export function VoidReasonOptions({
  items,
  isLoading,
}: {
  items: VoidReasonItem[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  return (
    <>
      <option value="">
        {t(isLoading ? "voiding.dialog.loading" : "voiding.dialog.placeholder")}
      </option>
      {items.map((item) => (
        <option key={item.code} value={item.code}>
          {language === "en" && item.label_en.trim() !== "" ? item.label_en : item.label_es}
        </option>
      ))}
    </>
  );
}
