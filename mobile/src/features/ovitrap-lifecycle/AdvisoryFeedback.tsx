import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { LifecycleCommand } from "./LifecycleCommand.tsx";
import type { LifecycleProps } from "./model.ts";
import type { AdvisoryView } from "./advisory.ts";
function advisoryLabel(value: AdvisoryView | null | undefined) {
  if (value?.state === "available")
    return value.body.suggested
      ? ("mobile.lifecycle.advisorySuggested" as const)
      : ("mobile.lifecycle.advisoryNotSuggested" as const);
  return value?.reason === "future_cutoff"
    ? ("mobile.lifecycle.advisoryFuture" as const)
    : ("mobile.lifecycle.advisoryUnavailable" as const);
}
function advisoryLines(value: AdvisoryView | null | undefined, t: ReturnType<typeof useT>) {
  if (value?.state !== "available") return [];
  return [
    t("mobile.lifecycle.advisoryCounts", {
      weeks: value.body.observed_closed_house_weeks?.length ?? "",
      incidents: value.body.incident_count ?? "",
    }),
    t("mobile.lifecycle.advisoryAt", { at: value.body.as_of }),
  ];
}
export function AdvisoryFeedback({ model, draft }: LifecycleProps) {
  const t = useT(),
    advisory = model.state?.advisory;
  return (
    <View>
      <Notice tone="info" icon="alert" message={t(advisoryLabel(advisory))} />
      {advisoryLines(advisory, t).map((text) => (
        <AppText key={text}>{text}</AppText>
      ))}
      {model.state?.suggestion ? <AppText>{t("mobile.lifecycle.legacyAdvisory")}</AppText> : null}
      <LifecycleCommand model={model} eventId={draft.eventId} command="refreshAdvisory" />
    </View>
  );
}
