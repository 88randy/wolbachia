import { LifecycleLoading } from "./LifecycleLoading.tsx";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { P15Screen } from "./P15Screen.tsx";
import { P16Screen } from "./P16Screen.tsx";
import { P17Screen } from "./P17Screen.tsx";
import { LifecycleFeedback } from "./LifecycleFeedback.tsx";
import { LifecycleHistory } from "./LifecycleHistory.tsx";
import type { M09Model } from "./use-m-09.ts";
import { Notice } from "../../ui/Notice.tsx";
export function LifecycleBody({ model }: { readonly model: M09Model }) {
  const t = useT();
  const state = model.state;
  const draft = state?.draft;
  if (!state) return <LifecycleLoading />;
  if (!draft)
    return state.recovery ? (
      <Notice tone="warning" icon="alert" message={t("mobile.lifecycle.recoveryBlocked")} />
    ) : (
      <AppText>{t("mobile.lifecycle.empty")}</AppText>
    );
  const props = { draft, model },
    Form = { replace: P15Screen, relocate: P16Screen, remove: P17Screen }[draft.kind];
  return (
    <View>
      {state.event ? (
        <LifecycleFeedback {...props} />
      ) : !state.isShiftBlocked && !state.isScopeBlocked ? (
        <Form key={draft.eventId} {...props} />
      ) : null}
      <LifecycleHistory model={model} />
    </View>
  );
}
