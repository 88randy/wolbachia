import { RotateCw } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { DayFailure } from "./day-view-controller.ts";

/** One failed step of the day in plain words, with a button to try it again. */
export function RouteProblem({
  failure,
  retry,
  isBusy,
}: {
  readonly failure: DayFailure | null;
  readonly retry: () => Promise<void>;
  readonly isBusy: boolean;
}) {
  const t = useT();
  if (failure === null) return null;
  return (
    <>
      <InfoNotice tone="warning" message={t(failure.key)} />
      <SecondaryButton
        icon={RotateCw}
        label={t("field.action.retry")}
        disabled={isBusy}
        onPress={() => {
          void retry();
        }}
      />
    </>
  );
}
