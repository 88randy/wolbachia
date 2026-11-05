import { View } from "react-native";

import { useT } from "../i18n/I18nProvider.tsx";
import { Notice } from "../ui/Notice.tsx";
import { Button } from "../ui/Button.tsx";

export function IdleWarning({ keepWorking }: { readonly keepWorking: () => void }) {
  const t = useT();
  return (
    <View>
      <Notice tone="warning" icon="alert" message={t("mobile.unlock.idleWarning")} />
      <Button label={t("mobile.unlock.keepWorking")} onPress={keepWorking} />
    </View>
  );
}
