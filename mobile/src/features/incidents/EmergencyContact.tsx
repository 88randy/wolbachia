import { Phone } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { telephoneNumber } from "./domain.ts";
import type { M12Model } from "./use-m-12.ts";

const OUTCOME_KEYS = {
  opened: "mobile.incidents.dialerOpened",
  unavailable: "mobile.incidents.dialerUnavailable",
  missing: "mobile.incidents.contactMissing",
} as const;
/** The cached support number is labelled as a work contact, never a fabricated emergency service. */
export function EmergencyContact({ model }: { readonly model: M12Model }) {
  const t = useT();
  const contact = telephoneNumber(model.state?.supportContact ?? null);
  return (
    <>
      <PrimaryButton
        tone="danger"
        icon={Phone}
        label={t("mobile.incidents.callWorkContact")}
        disabled={contact === null}
        onPress={() => {
          void model.call();
        }}
      />
      {contact ? (
        <AppText variant="h2" className="text-center" selectable>
          {contact}
        </AppText>
      ) : (
        <InfoNotice tone="warning" message={t("mobile.incidents.contactMissing")} />
      )}
      <AppText variant="body" tone="secondary" className="text-center">
        {t("mobile.incidents.callFallback")}
      </AppText>
      {model.dialOutcome ? (
        <InfoNotice tone="info" message={t(OUTCOME_KEYS[model.dialOutcome])} />
      ) : null}
    </>
  );
}
