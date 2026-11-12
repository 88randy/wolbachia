import { PackageOpen, Truck } from "lucide-react-native";
import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { pendingDeliveries } from "./pending-deliveries.ts";
import { ReceiptFrame } from "./ReceiptFrame.tsx";
import type { M05Model } from "./use-m-05.ts";

/** "9 de noviembre": the delivery date in plain words; the raw value if it cannot be read. */
function deliveryDate(date: string, locale: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(parsed);
}

/** Nothing started yet: pick the delivery you are receiving, or continue one you left half done. */
export function ReleasePicker({ model }: { readonly model: M05Model }) {
  const t = useT();
  const locale = useLocale();
  const state = model.state;
  if (state === null)
    return (
      <ReceiptFrame model={model}>
        <Skeleton />
      </ReceiptFrame>
    );
  const releases = pendingDeliveries(
    state.assignments,
    state.shiftId,
    state.drafts.map((draft) => draft.releaseId),
  );
  const isEmpty = releases.length === 0 && state.drafts.length === 0;
  return (
    <ReceiptFrame model={model}>
      <StepQuestion title={t("field.receipt.pickQuestion")} hint={t("field.receipt.pickHint")} />
      {isEmpty ? (
        <EmptyState
          icon={PackageOpen}
          title={t(state.ready ? "field.receipt.none" : "field.receipt.notReady")}
          message={t("field.receipt.noneHint")}
        />
      ) : null}
      <View className="gap-3">
        {state.drafts.map((draft) => (
          <ChoiceRow
            key={draft.eventId}
            icon={Truck}
            label={t("field.receipt.resume")}
            hint={t("field.receipt.resumeHint")}
            isSelected={false}
            disabled={model.isBusy}
            onPress={() => {
              void model.run(() => model.service.select(draft.eventId));
            }}
          />
        ))}
        {releases.map(({ assignment, release }) => (
          <ChoiceRow
            key={release.id}
            icon={Truck}
            label={t("field.receipt.delivery", { date: deliveryDate(assignment.date, locale) })}
            hint={
              release.lines.length === 1
                ? t("field.receipt.deliveryCountOne")
                : t("field.receipt.deliveryCount", { count: release.lines.length })
            }
            isSelected={false}
            disabled={model.isBusy || !state.ready}
            onPress={() => {
              void model.run(() => model.service.begin(assignment.id, release.id));
            }}
          />
        ))}
      </View>
    </ReceiptFrame>
  );
}
