import type { UseFormReturn } from "react-hook-form";
import type { CatalogValues } from "./catalog-schema";
import { CatalogTextField } from "./CatalogTextField";
interface Props {
  form: UseFormReturn<CatalogValues>;
  isCreate: boolean;
  isBusy: boolean;
}
/** Codes are immutable after creation; labels are editable in both languages. */
export function CatalogFormFields({ form, isCreate, isBusy }: Props) {
  const fields = isCreate
    ? (["code", "label_es", "label_en"] as const)
    : (["label_es", "label_en"] as const);
  return fields.map((field) => (
    <CatalogTextField key={field} form={form} field={field} isBusy={isBusy} />
  ));
}
