import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { Button } from "../../ui/Button.tsx";
import type { M12Model } from "./use-m-12.ts";

export function IncidentFeedback({ model }: { readonly model: M12Model }) {
  const t = useT();
  if (!model.errorKey) return null;
  return (
    <View>
      <Notice tone="critical" icon="alert" message={t(model.errorKey)} />
      <Button
        variant="outline"
        label={t("common.actions.retry")}
        disabled={model.isBusy}
        onPress={() => {
          void model.run(model.refresh);
        }}
      />
    </View>
  );
}
