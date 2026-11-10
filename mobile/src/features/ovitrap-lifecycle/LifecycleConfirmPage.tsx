import { MapPin } from "lucide-react-native";
import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { kitShadow } from "../../ui/kit-styles.ts";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { catalogLabel } from "../ovitrap-check/labels.ts";
import { P15Screen } from "./P15Screen.tsx";
import { P16Screen } from "./P16Screen.tsx";
import { P17Screen } from "./P17Screen.tsx";
import type { LifecycleProps } from "./model.ts";
import { useAutoGps } from "./use-auto-gps.ts";

function Extra(props: LifecycleProps) {
  if (props.draft.kind === "replace") return <P15Screen />;
  if (props.draft.kind === "relocate") return <P16Screen {...props} />;
  return <P17Screen />;
}

/** Last page: what you are about to save, the location, and the review notice when it applies. */
export function LifecycleConfirmPage(props: LifecycleProps) {
  const { model, draft } = props;
  const t = useT();
  const locale = useLocale();
  useAutoGps(props);
  const reason = draft.catalog?.[draft.kind].find((item) => item.code === draft.reasonCode);
  const gate = model.state?.gate;
  return (
    <>
      <StepQuestion title={t("field.lifecycle.confirmQuestion")} />
      <View className="gap-2 rounded-card border border-line bg-surface p-4" style={kitShadow.card}>
        <AppText variant="h2">
          {t("field.lifecycle.confirmPoint", { code: draft.point.code })}
        </AppText>
        <AppText variant="bodyStrong">{t(`field.lifecycle.kind.${draft.kind}`)}</AppText>
        {reason ? <AppText>{catalogLabel(reason, locale)}</AppText> : null}
        {draft.recovery ? (
          <AppText>{t(`field.lifecycle.recovery.${draft.recovery}`)}</AppText>
        ) : null}
        <AppText tone="secondary">
          {t("field.lifecycle.photosCount", { count: draft.evidence.length })}
        </AppText>
      </View>
      <Extra {...props} />
      {draft.gps ? (
        <InfoNotice tone="success" message={t("field.lifecycle.gpsReady")} />
      ) : (
        <>
          <InfoNotice tone="warning" message={t("field.lifecycle.gpsMissing")} />
          <SecondaryButton
            icon={MapPin}
            label={t("field.lifecycle.gpsRetry")}
            disabled={model.isBusy}
            onPress={() => {
              void model.run(() => model.service.refreshGps(draft.eventId), draft.eventId);
            }}
          />
        </>
      )}
      {gate === "review" || draft.reviewAcknowledged ? (
        <ChoiceRow
          label={t("field.lifecycle.acknowledge")}
          isSelected={draft.reviewAcknowledged}
          disabled={model.isBusy}
          onPress={() => {
            model.edit({ reviewAcknowledged: !draft.reviewAcknowledged }, draft.eventId);
          }}
        />
      ) : null}
      {gate && gate !== "review" ? (
        <InfoNotice
          tone="warning"
          message={t(
            gate === "training" ? "field.lifecycle.needTraining" : "field.lifecycle.incomplete",
          )}
        />
      ) : null}
    </>
  );
}
