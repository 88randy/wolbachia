import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { AdvisoryView } from "./advisory.ts";
import type { LifecycleProps } from "./model.ts";

function advisoryKey(value: AdvisoryView | null | undefined) {
  if (value?.state === "available")
    return value.body.suggested
      ? ("field.lifecycle.advisorySuggested" as const)
      : ("field.lifecycle.advisoryNotSuggested" as const);
  return "field.lifecycle.advisoryUnavailable" as const;
}

/** For a move request: the system opinion in one calm sentence. The supervisor decides. */
export function AdvisoryFeedback({ model }: LifecycleProps) {
  const t = useT();
  return (
    <InfoNotice
      tone="info"
      title={t("field.lifecycle.advisoryTitle")}
      message={t(advisoryKey(model.state?.advisory))}
    />
  );
}
