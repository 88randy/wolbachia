import { View } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import type { M14Model } from "./use-m-14.ts";
export function PendingPoints({ model }: { readonly model: M14Model }) {
  const styles = useStyles(createShiftStyles);
  const t = useT(); const { push } = useNavigation();
  const draft = model.state?.draft;
  if (!draft) return null;
  return <View style={styles.group}>
    <AppText variant="button">{t("mobile.shiftClose.pending")}</AppText>
    {!(model.state?.pending ?? []).length ? <AppText>{t("mobile.shiftClose.noPending")}</AppText> : null}
    {(model.state?.pending ?? []).map((point) => <Card key={point.taskId}>
      <AppText variant="mono">{point.pointCode}</AppText>
      <Button label={t("mobile.shiftClose.goNow")} variant="outline" disabled={model.isBusy} onPress={() => { void model.run(() => { push({ name: "day" }); return Promise.resolve(); }); }} />
      <Button label={t(draft.dispositions[point.taskId] === "leave_pending" ? "mobile.shiftClose.leftPending" : "mobile.shiftClose.leavePending")} variant="text" disabled={model.isBusy} onPress={() => { model.edit({ dispositions: { ...draft.dispositions, [point.taskId]: "leave_pending" } }); }} />
    </Card>)}
  </View>;
}
