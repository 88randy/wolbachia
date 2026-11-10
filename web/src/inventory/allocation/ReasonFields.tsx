import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "../../forms/Select";
import { TextField } from "../../forms/TextField";
import { useLanguage } from "../../i18n/use-language";
import type { ReasonFields as Fields } from "./use-reason-fields";

function useReasonOptions(fields: Fields) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const placeholder = t(fields.isLoading ? "voiding.dialog.loading" : "voiding.dialog.placeholder");
  const label = (item: Fields["items"][number]) =>
    language === "en" && item.label_en.trim() !== "" ? item.label_en : item.label_es;
  return [
    { value: "", label: placeholder },
    ...fields.items.map((item) => ({ value: item.code, label: label(item) })),
  ];
}

function OtherReasonText({ id, fields }: { id: string; fields: Fields }) {
  const { t } = useTranslation();
  return (
    <TextField
      id={id}
      label={t("allocation.field.reasonText")}
      required
      minLength={fields.minReasonLength}
      maxLength={fields.maxReasonLength}
      value={fields.reason}
      hint={t("allocation.field.reasonTextHint", { count: fields.minReasonLength })}
      onChange={(event) => {
        fields.setReason(event.target.value);
      }}
    />
  );
}

/** Reason from the organization catalog; the free text appears only for the "Other" item. */
export function ReasonFields({ fields }: { fields: Fields }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <>
      <Select
        id={`${id}-code`}
        label={t("allocation.field.reason")}
        required
        disabled={fields.isBlocked}
        value={fields.reasonCode}
        options={useReasonOptions(fields)}
        onChange={(event) => {
          fields.setReasonCode(event.target.value);
        }}
      />
      {fields.isOtherReason && <OtherReasonText id={`${id}-text`} fields={fields} />}
    </>
  );
}
