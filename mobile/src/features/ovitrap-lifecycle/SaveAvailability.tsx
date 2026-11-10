import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
export function SaveAvailability({
  isBlocked,
  gate,
}: {
  readonly isBlocked: boolean;
  readonly gate: string | null | undefined;
}) {
  const t = useT();
  return isBlocked ? (
    <AppText accessibilityLiveRegion="polite">
      {t(
        gate === "training"
          ? "trainings.mobile.boundary"
          : gate === "review"
            ? "mobile.lifecycle.reviewAcknowledge"
            : "mobile.lifecycle.incomplete",
      )}
    </AppText>
  ) : null;
}
