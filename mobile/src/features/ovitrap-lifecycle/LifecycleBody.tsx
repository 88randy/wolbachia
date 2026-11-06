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
export function LifecycleBody({ model }: { readonly model: M09Model }) {
  const t = useT();
  const state = model.state;
  const draft = state?.draft;
  if (!state) return <LifecycleLoading />;
  if (!draft) return <AppText>{t("mobile.lifecycle.empty")}</AppText>;
  const props = { draft, model };
  return (
    <View>
      {state.event ? (
        <LifecycleFeedback {...props} />
      ) : !state.isShiftBlocked && !state.isScopeBlocked ? (
        <View>
          {draft.kind === "replace" ? (
            <P15Screen key={draft.eventId} {...props} />
          ) : draft.kind === "relocate" ? (
            <P16Screen key={draft.eventId} {...props} />
          ) : (
            <P17Screen key={draft.eventId} {...props} />
          )}
        </View>
      ) : null}
      <LifecycleHistory model={model} />
    </View>
  );
}
