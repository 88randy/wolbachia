import { Inbox } from "lucide-react-native";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
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
    <>
      <InfoNotice
        tone={model.status === "critical_rejected" ? "danger" : "success"}
        message={t(STATUS_KEYS[model.status])}
      />
      {keys.map((key) => (
        <InfoNotice key={key} tone="info" message={t(key)} />
      ))}
      <SecondaryButton icon={Inbox} label={t("mobile.sample.inbox")} onPress={model.openInbox} />
    </>
  );
}
