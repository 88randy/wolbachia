import { useState } from "react";
import { useForm } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { MessageKey } from "@wolbachia/i18n";
import type { SyntheticEvent } from "react";
import { catalogCreateSchema } from "./catalog-schema";
import type { CatalogValues } from "./catalog-schema";
import type { CatalogItem } from "./catalogs-query";
import type { CatalogEditor } from "./use-catalog-editor";
import type { CatalogOutcome } from "./catalog-outcome";
function defaultsOf(item?: CatalogItem): CatalogValues {
  return { code: item?.code ?? "", label_es: item?.label_es ?? "", label_en: item?.label_en ?? "" };
}
function showFieldIssues(
  form: UseFormReturn<CatalogValues>,
  outcome: Extract<CatalogOutcome, { kind: "failed" }>,
) {
  const fields = Object.entries(outcome.fields);
  fields.forEach(([field, message], index) => {
    form.setError(
      field as keyof CatalogValues,
      { type: "server", message },
      { shouldFocus: index === 0 },
    );
  });
}
/** Local validation and coded field errors; stale answers cannot change the draft or close it. */
export function useCatalogForm(editor: CatalogEditor, item?: CatalogItem) {
  const form = useForm<CatalogValues>({
    resolver: zodResolver(catalogCreateSchema),
    mode: "onBlur",
    defaultValues: defaultsOf(item),
  });
  const [error, setError] = useState<MessageKey | null>(null);
  const submit = form.handleSubmit(async (values) => {
    const outcome = await editor.save(values, item);
    if (outcome.kind === "stale") return;
    if (outcome.kind === "saved") {
      editor.setDialog(null);
      editor.setAnnouncement(editor.t("catalogs.actions.saved"));
      return;
    }
    setError(outcome.key);
    showFieldIssues(form, outcome);
  });
  return {
    form,
    error,
    onSubmit: (event: SyntheticEvent) => {
      void submit(event);
    },
  };
}
