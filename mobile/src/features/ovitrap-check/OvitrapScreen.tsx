import { PointLifecycleEntry } from "../ovitrap-lifecycle/PointLifecycleEntry.tsx";
import { SnapshotNotices } from "./SnapshotNotices.tsx";
import { ScrollView, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { CaptureActions } from "./CaptureActions.tsx";
import { CaptureBody } from "./CaptureBody.tsx";
import { CaptureOutcome } from "./CaptureOutcome.tsx";
import { useM08 } from "./use-m-08.ts";
export function OvitrapScreen() {
  const model = useM08();
  const t = useT();
  const styles = useStyles(createShiftStyles);
  const draft = model.state?.draft;
  return (
    <View style={styles.root}>
      <ScreenHeader largeTargets title={t("mobile.ovitrap.open")} subtitle={draft?.point?.code} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {model.errorKey ? (
          <Notice tone="critical" icon="alert" message={t(model.errorKey)} />
        ) : null}
        <CaptureActions model={model} />
        <SnapshotNotices model={model} />
        <PointLifecycleEntry model={model} />
        {model.state?.event ? (
          <CaptureOutcome event={model.state.event} />
        ) : draft && !model.state?.isShiftBlocked ? (
          <CaptureBody model={model} draft={draft} />
        ) : null}
      </ScrollView>
    </View>
  );
}
