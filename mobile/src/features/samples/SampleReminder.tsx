import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { SampleViewModel } from "./view-model.ts";

/** Reception is a downloaded fact, never inferred from a successful sync or a local toggle. */
export function SampleReminder({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  if (model.status === "draft") return null;
  return (
    <InfoNotice
      tone={model.receiptAt ? "success" : "info"}
      message={t(model.receiptAt ? "mobile.sample.received" : "mobile.sample.deliver")}
    />
  );
}
