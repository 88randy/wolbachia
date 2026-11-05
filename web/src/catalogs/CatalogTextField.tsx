import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import type { UseFormReturn } from "react-hook-form";
import { TextField } from "../forms/TextField";
import type { CatalogValues } from "./catalog-schema";
import styles from "./catalogs.module.css";
const LABELS = {
  code: "catalogs.form.code",
  label_es: "catalogs.form.spanish",
  label_en: "catalogs.form.english",
} as const;
interface Props {
  form: UseFormReturn<CatalogValues>;
  field: keyof CatalogValues;
  isBusy: boolean;
}
/** Optional English previews its fallback; each server/schema issue is translated by key. */
export function CatalogTextField({ form, field, isBusy }: Props) {
  const { t } = useTranslation();
  const message = form.formState.errors[field]?.message;
  const isEnglish = field === "label_en";
  return (
    <>
      <TextField
        id={`catalog-${field}`}
        label={t(LABELS[field])}
        {...form.register(field)}
        error={message ? t(message as MessageKey) : undefined}
        disabled={isBusy}
        hint={isEnglish ? t("catalogs.form.fallback") : undefined}
        autoComplete="off"
      />
      {isEnglish && form.watch("label_en").trim() === "" && (
        <p className={styles.warning} role="status">
          {t("catalogs.form.warning")}
        </p>
      )}
    </>
  );
}
