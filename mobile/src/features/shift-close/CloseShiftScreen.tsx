import { ScrollView, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { Button } from "../../ui/Button.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { P26Screen } from "./P26Screen.tsx";
import { P27Screen } from "./P27Screen.tsx";
import { CloseSkeleton } from "./CloseSkeleton.tsx";
import { useM14 } from "./use-m-14.ts";
export function CloseShiftScreen() {
  const model = useM14(); const t = useT(); const styles = useStyles(createShiftStyles);
  return <View style={styles.root}>
    <ScreenHeader title={t(model.state?.draft?.locallyClosedAt ? "mobile.shiftClose.closedTitle" : "mobile.shiftClose.title")} />
    <View style={styles.footer}>
      {model.hasError ? <><Notice tone="critical" icon="alert" message={t("mobile.shiftClose.saveFailed")} /><Button label={t("common.actions.retry")} onPress={() => { void model.run(() => model.service.start()); }} /></> : null}
    </View>
    {model.state === null ? <CloseSkeleton /> : model.state.draft?.locallyClosedAt ? <ScrollView contentContainerStyle={styles.content}><P27Screen state={model.state} /></ScrollView> : <P26Screen model={model} />}
  </View>;
}
