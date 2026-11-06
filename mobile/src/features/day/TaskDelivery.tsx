import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import type { DayTask } from "./domain.ts";

/** A receipt and outstanding local work can coexist; neither implies task completion. */
export function TaskDelivery({ delivery }: { readonly delivery: DayTask["delivery"] }) {
  const t = useT();
  return (
    <>
      {delivery.hasPendingUpload ? <AppText>{t("mobile.day.phoneSaved")}</AppText> : null}
      {delivery.hasServerReceipt ? <AppText>{t("mobile.day.serverReceived")}</AppText> : null}
      {delivery.hasRejectedReceipt ? <AppText>{t("mobile.day.receiptRejected")}</AppText> : null}
      {delivery.isReviewPending ? <AppText>{t("mobile.day.captureInReview")}</AppText> : null}
    </>
  );
}
