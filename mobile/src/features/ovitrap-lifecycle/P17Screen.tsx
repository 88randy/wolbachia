import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { LifecycleFields } from "./LifecycleFields.tsx";
import { RECOVERY_LABEL } from "./labels.ts";
import type { LifecycleProps } from "./model.ts";
export function P17Screen(props: LifecycleProps) {
  const t = useT();
  const { draft, model } = props;
  return (
    <View>
      <AppText variant="h2">{t("mobile.lifecycle.recovery")}</AppText>
      {(["recovered", "unrecovered", "unconfirmed"] as const).map((recovery) => (
        <ShiftAction
          key={recovery}
          label={t(RECOVERY_LABEL[recovery])}
          selected={draft.recovery === recovery}
          disabled={model.isBusy}
          onPress={() => {
            model.edit({ recovery }, draft.eventId);
          }}
        />
      ))}
      {draft.recovery && draft.recovery !== "recovered" ? (
        <Notice tone="warning" icon="alert" message={t("mobile.lifecycle.recoveryNotice")} />
      ) : null}
      <LifecycleFields {...props} />
    </View>
  );
}
