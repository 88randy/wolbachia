import { Phone } from "lucide-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { DialOutcome } from "./domain.ts";

const OUTCOMES = {
  opened: "mobile.incidents.dialerOpened",
  unavailable: "mobile.incidents.dialerUnavailable",
  missing: "mobile.incidents.contactMissing",
} as const;
const MIN_BOTTOM_GAP = 16;

/** Calm outlined control with side gutters; the lock screen must not shout. */
export function LockedCallAction(props: {
  readonly outcome: DialOutcome | null;
  readonly call: () => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <View
      className="gap-3 px-5 pt-4"
      style={{ paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_GAP) + MIN_BOTTOM_GAP }}
    >
      <SecondaryButton
        tone="danger"
        icon={Phone}
        label={t("mobile.incidents.callWorkContact")}
        onPress={props.call}
      />
      {props.outcome ? <InfoNotice tone="warning" message={t(OUTCOMES[props.outcome])} /> : null}
      <AppText variant="caption" tone="secondary" style={{ textAlign: "center" }}>
        {t("mobile.incidents.callFallback")}
      </AppText>
    </View>
  );
}
