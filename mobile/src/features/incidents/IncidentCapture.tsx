import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { IncidentStatus } from "./IncidentStatus.tsx";
import { IncidentForm } from "./IncidentForm.tsx";
import type { IncidentKind } from "./types.ts";
import type { M12Model } from "./use-m-12.ts";
interface Props {
  readonly model: M12Model;
  readonly kind: IncidentKind;
}
export function IncidentCapture({ model, kind }: Props) {
  const t = useT(),
    state = model.state;
  if (!state)
    return (
      <Card>
        <Skeleton />
        <Skeleton isShort />
        <Skeleton />
      </Card>
    );
  if (state.draft?.kind !== kind)
    return (
      <Card>
        <AppText>
          {t(kind === "report" ? "mobile.incidents.empty" : "mobile.incidents.accidentHint")}
        </AppText>
      </Card>
    );
  const draftKey = model.hasPending
    ? "mobile.incidents.draftPending"
    : "mobile.incidents.draftSaved";
  return (
    <View>
      <IncidentStatus state={state} />
      {state.event ? null : <AppText variant="caption">{t(draftKey)}</AppText>}
      <IncidentForm model={model} />
    </View>
  );
}
