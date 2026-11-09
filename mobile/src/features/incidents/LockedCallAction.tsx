import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
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
    <View>
      <Button
        label={t("mobile.incidents.callWorkContact")}
        variant="outline"
        onPress={props.call}
      />
      {props.outcome ? (
        <Notice tone="warning" icon="phone" message={t(OUTCOMES[props.outcome])} />
      ) : null}
      <AppText variant="caption">{t("mobile.incidents.callFallback")}</AppText>
    </View>
  );
}
