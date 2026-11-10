import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { SampleViewModel } from "./view-model.ts";

/** Reception is a downloaded fact, never inferred from a successful sync or a local toggle. */
export function SampleReminder({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  if (model.status === "draft") return null;
  return (
    <Card>
      <Notice
        tone="info"
        icon={model.receiptAt ? "cloudOk" : "clock"}
        message={t(model.receiptAt ? "mobile.sample.received" : "mobile.sample.deliver")}
      />
      <AppText>{t("mobile.sample.noResultAssumption")}</AppText>
      {model.receiptAt ? (
        <AppText isMonospace>{model.receiptAt}</AppText>
      ) : (
        <AppText>{t("mobile.sample.receiptUnknown")}</AppText>
      )}
    </Card>
  );
}
