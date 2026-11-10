import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { ReleaseViewModel, ReleaseViewStatus } from "./view-model.ts";

const STATUS_KEYS = {
  phone_saved: "mobile.release.phoneSaved",
  server_received: "mobile.release.serverReceived",
  in_review: "mobile.release.inReview",
  critical_rejected: "mobile.release.criticalRejected",
} as const satisfies Record<Exclude<ReleaseViewStatus, "draft">, string>;

export function ReleaseStatus({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  if (model.status === "draft") return null;
  const detailKeys = [
    model.evidencePending ? "mobile.release.evidencePending" : null,
    model.resultKey,
    model.reviewedKey,
  ].filter((key): key is MessageKey => key !== null);
  const notice = {
    tone: model.status === "critical_rejected" ? "critical" : "info",
    icon: model.status === "phone_saved" ? "phone" : "cloudOk",
    message: t(STATUS_KEYS[model.status]),
  } as const;
  return (
    <Card isCritical={model.status === "critical_rejected"}>
      <Notice {...notice} />
      {detailKeys.map((key) => (
        <AppText key={key}>{t(key)}</AppText>
      ))}
      <Button variant="outline" label={t("mobile.release.openInbox")} onPress={model.openInbox} />
    </Card>
  );
}
