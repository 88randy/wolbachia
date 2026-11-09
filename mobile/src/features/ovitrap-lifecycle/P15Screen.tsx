import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { LifecycleFields } from "./LifecycleFields.tsx";
import type { LifecycleProps } from "./model.ts";
export function P15Screen(props: LifecycleProps) {
  const t = useT();
  return (
    <View>
      <Notice tone="info" icon="alert" message={t("mobile.lifecycle.fixedCode")} />
      <AppText>{t("mobile.lifecycle.source")}</AppText>
      <AppText>{props.draft.ovitrapId}</AppText>
      <AppText>{t("mobile.lifecycle.replacement")}</AppText>
      <AppText>{props.draft.replacementId}</AppText>
      <LifecycleFields {...props} />
    </View>
  );
}
