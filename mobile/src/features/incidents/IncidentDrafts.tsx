import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { IncidentKind } from "./types.ts";
import type { M12Model } from "./use-m-12.ts";

export function IncidentDrafts({
  model,
  kind,
}: {
  readonly model: M12Model;
  readonly kind: IncidentKind;
}) {
  const t = useT(),
    drafts = model.state?.drafts.filter((draft) => draft.kind === kind) ?? [];
  if (!drafts.length) return null;
  return (
    <View>
      <AppText variant="bodyStrong">{t("mobile.incidents.onPhone")}</AppText>
      {drafts.map((draft) => (
        <ShiftAction
          key={draft.eventId}
          label={`${draft.type?.label ?? t("mobile.incidents.accident")} · ${draft.deviceTime}`}
          selected={model.state?.draft?.eventId === draft.eventId}
          disabled={model.isBusy}
          onPress={() => {
            void model.recover(() => model.service.select(draft.eventId));
          }}
        />
      ))}
    </View>
  );
}
