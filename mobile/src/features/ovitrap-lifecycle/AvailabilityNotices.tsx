import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { M09Model } from "./use-m-09.ts";
export function AvailabilityNotices({ model }: { readonly model: M09Model }) {
  const t = useT();
  return (
    <View>
      {model.state?.frameState === "closed" || model.state?.frameState === "unknown" ? (
        <Notice
          tone="warning"
          icon="alert"
          message={t(
            model.state.frameState === "closed"
              ? "mobile.lifecycle.epochClosed"
              : "mobile.lifecycle.epochUnknown",
          )}
        />
      ) : null}
      {model.state?.isScopeBlocked ? (
        <Notice tone="warning" icon="alert" message={t("mobile.lifecycle.scopeBlocked")} />
      ) : null}
      {model.state?.isShiftBlocked ? (
        <Notice tone="warning" icon="alert" message={t("mobile.ovitrap.shiftBlocked")} />
      ) : null}
    </View>
  );
}
