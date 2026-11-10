import { Phone } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import type { DialOutcome } from "./domain.ts";

const OUTCOMES = {
  opened: "mobile.incidents.dialerOpened",
  unavailable: "mobile.incidents.dialerUnavailable",
  missing: "mobile.incidents.contactMissing",
} as const;
export function LockedCallAction(props: {
  readonly outcome: DialOutcome | null;
  readonly call: () => void;
}) {
  const t = useT();
  return (
    <>
      <PrimaryButton
        tone="danger"
        icon={Phone}
        label={t("mobile.incidents.callWorkContact")}
        onPress={props.call}
      />
      {props.outcome ? <InfoNotice tone="warning" message={t(OUTCOMES[props.outcome])} /> : null}
      <AppText variant="caption" tone="secondary">
        {t("mobile.incidents.callFallback")}
      </AppText>
    </>
  );
}
