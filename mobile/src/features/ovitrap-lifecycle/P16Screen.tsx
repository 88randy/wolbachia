import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { LifecycleFields } from "./LifecycleFields.tsx";
import type { LifecycleProps } from "./model.ts";
import { AdvisoryFeedback } from "./AdvisoryFeedback.tsx";
export function P16Screen(props: LifecycleProps) {
  const t = useT();
  const suggestion = props.model.state?.suggestion;
  return (
    <View>
      <Notice tone="info" icon="alert" message={t("mobile.lifecycle.proposalOnly")} />
      <AdvisoryFeedback {...props} />
      {suggestion ? (
        <View>
          <Notice tone="warning" icon="alert" message={t("mobile.lifecycle.inspectHistory")} />
          <AppText>{t("mobile.lifecycle.closedWeeks")}</AppText>
          <AppText>{String(suggestion.closedHouseWeeks)}</AppText>
        </View>
      ) : null}
      <AppText>{t("mobile.lifecycle.proposedLocation")}</AppText>
      <AppText>
        {props.draft.proposedLocation?.join(", ") ?? t("mobile.lifecycle.gpsRequired")}
      </AppText>
      <LifecycleFields {...props} />
    </View>
  );
}
