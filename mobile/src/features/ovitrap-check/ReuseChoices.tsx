import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { canReuse } from "./domain.ts";
import type { CaptureProps } from "./model.ts";
export function ReuseChoices({ model, draft }: CaptureProps) {
  const t = useT();
  const eligible =
    model.state?.reuse.filter((item) => canReuse(item, draft.rules?.maxPaddleReuses ?? 2)) ?? [];
  return (
    <View>
      <AppText>{t("mobile.ovitrap.reuseUnavailable")}</AppText>
      <ShiftAction
        label={t("mobile.ovitrap.newPaddle")}
        selected={draft.reuseId === null}
        disabled={model.isBusy}
        onPress={() => {
          model.edit({ reuseId: null });
        }}
      />
      {eligible.map((item) => (
        <ShiftAction
          key={item.id}
          label={`${t("mobile.ovitrap.reuse")} ${item.id}`}
          selected={draft.reuseId === item.id}
          disabled={model.isBusy}
          onPress={() => {
            model.edit({ reuseId: item.id });
          }}
        />
      ))}
    </View>
  );
}
