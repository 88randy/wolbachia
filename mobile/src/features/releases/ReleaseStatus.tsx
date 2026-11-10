import { Inbox } from "lucide-react-native";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
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
  const tone = model.status === "critical_rejected" ? "danger" : "success";
  return (
    <>
      <InfoNotice tone={tone} message={t(STATUS_KEYS[model.status])} />
      {detailKeys.map((key) => (
        <InfoNotice key={key} tone="info" message={t(key)} />
      ))}
      <SecondaryButton
        icon={Inbox}
        label={t("mobile.release.openInbox")}
        onPress={model.openInbox}
      />
    </>
  );
}
