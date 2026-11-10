import { CircleCheck, Home } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { BigActionCard } from "../../ui/BigActionCard.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";

function bodyKey(status: OutboxEvent["status"]) {
  if (status === "sent") return "field.receipt.sentBody";
  if (status === "in_review") return "field.receipt.reviewBody";
  if (status === "rejected") return "field.receipt.rejectedBody";
  return "field.receipt.savedBody";
}

/** The receipt is kept on the phone and goes out by itself. One button returns to Mi día. */
export function ReceiptSaved({ event }: { readonly event: OutboxEvent }) {
  const t = useT();
  const { popToRoot } = useNavigation();
  return (
    <ScreenScaffold
      header={<AppHeader title={t("field.receipt.title")} onBack={null} />}
      footer={<PrimaryButton icon={Home} label={t("field.action.done")} onPress={popToRoot} />}
    >
      <BigActionCard
        eyebrow={t("field.receipt.savedEyebrow")}
        icon={CircleCheck}
        title={t("field.receipt.savedTitle")}
        body={t(bodyKey(event.status))}
      />
    </ScreenScaffold>
  );
}
