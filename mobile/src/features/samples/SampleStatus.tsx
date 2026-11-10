import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { SampleViewModel } from "./view-model.ts";

const STATUS_KEYS = {
  phone_saved: "mobile.sample.phoneSaved",
  server_received: "mobile.sample.serverReceived",
  in_review: "mobile.sample.inReview",
  critical_rejected: "mobile.sample.rejected",
} as const;
export function SampleStatus({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  if (model.status === "draft") return null;
  const keys = [
    model.evidencePending ? "mobile.sample.evidencePending" : null,
    model.resultKey,
    model.reviewedKey,
  ].filter((key): key is MessageKey => key !== null);
  return (
    <Card isCritical={model.status === "critical_rejected"}>
      <Notice
        tone={model.status === "critical_rejected" ? "critical" : "info"}
        icon={model.status === "phone_saved" ? "phone" : "cloudOk"}
        message={t(STATUS_KEYS[model.status])}
      />
      {keys.map((key) => (
        <AppText key={key}>{t(key)}</AppText>
      ))}
      <Button variant="outline" label={t("mobile.sample.inbox")} onPress={model.openInbox} />
    </Card>
  );
}
import type { MessageKey } from "@wolbachia/i18n";
