import { RotateCw } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { M12Model } from "./use-m-12.ts";

export function IncidentRefresh({ model }: { readonly model: M12Model }) {
  const t = useT();
  if (!model.readError && !model.isRefreshing) return null;
  return (
    <>
      {model.readError ? (
        <InfoNotice tone="warning" message={t("mobile.incidents.readFailed")} />
      ) : null}
      {model.isRefreshing ? (
        <InfoNotice tone="info" message={t("mobile.incidents.refreshing")} />
      ) : null}
      <SecondaryButton
        icon={RotateCw}
        label={t("common.actions.retry")}
        disabled={model.isRefreshing}
        onPress={() => {
          void model.refreshRemote();
        }}
      />
    </>
  );
}
