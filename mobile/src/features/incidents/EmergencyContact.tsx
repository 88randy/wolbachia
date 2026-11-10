import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { EmergencyAction } from "./EmergencyAction.tsx";
import { telephoneNumber } from "./domain.ts";
import type { M12Model } from "./use-m-12.ts";

const OUTCOME_KEYS = {
  opened: "mobile.incidents.dialerOpened",
  unavailable: "mobile.incidents.dialerUnavailable",
  missing: "mobile.incidents.contactMissing",
} as const;
/** The cached support number is labelled as a work contact, never a fabricated emergency service. */
export function EmergencyContact({ model }: { readonly model: M12Model }) {
  const t = useT(),
    contact = telephoneNumber(model.state?.supportContact ?? null);
  return (
    <View>
      <EmergencyAction
        label={t("mobile.incidents.callWorkContact")}
        icon="phone"
        disabled={contact === null}
        onPress={() => {
          void model.call();
        }}
      />
      {contact ? (
        <AppText isMonospace selectable>
          {contact}
        </AppText>
      ) : (
        <Notice tone="warning" icon="phone" message={t("mobile.incidents.contactMissing")} />
      )}
      <AppText>{t("mobile.incidents.callFallback")}</AppText>
      {model.dialOutcome ? (
        <Notice tone="info" icon="phone" message={t(OUTCOME_KEYS[model.dialOutcome])} />
      ) : null}
    </View>
  );
}
