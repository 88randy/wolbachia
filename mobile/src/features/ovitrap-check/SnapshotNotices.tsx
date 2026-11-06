import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { M08Model } from "./use-m-08.ts";
export function SnapshotNotices({ model }: { readonly model: M08Model }) {
  const t = useT();
  return (
    <View>
      {model.state?.isShiftBlocked ? (
        <Notice tone="warning" icon="alert" message={t("mobile.ovitrap.shiftBlocked")} />
      ) : null}
      {model.state?.catalogChanged ? (
        <Notice tone="warning" icon="alert" message={t("mobile.ovitrap.catalogChanged")} />
      ) : null}
      {model.state?.isScopeBlocked ? (
        <Notice tone="warning" icon="alert" message={t("mobile.ovitrap.gateAssignment")} />
      ) : null}
    </View>
  );
}
