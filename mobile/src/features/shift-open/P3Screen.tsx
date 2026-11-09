import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { captureShiftId } from "../ovitrap-check/shift-authorization.ts";
import { OvitrapEntry } from "../ovitrap-check/OvitrapEntry.tsx";
import { HomeShiftAction } from "./HomeShiftAction.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { ShiftAction } from "./ShiftAction.tsx";
import { HomeShiftCard } from "./HomeShiftCard.tsx";
import { SaveFeedback } from "./SaveFeedback.tsx";
import { createShiftStyles } from "./styles.ts";
import { useM04 } from "./use-m-04.ts";
/** No invented assignment, motorcycle availability or server receipt on the no-shift home. */
export function P3Screen() {
  const model = useM04();
  const t = useT();
  const { push } = useNavigation();
  const styles = useStyles(createShiftStyles);
  return (
    <AppScrollView style={styles.root} contentContainerStyle={styles.content}>
      <SaveFeedback model={model} />
      <HomeShiftCard state={model.state} />
      <HomeShiftAction model={model} />
      <OvitrapEntry isAllowed={Boolean(captureShiftId(model.state))} />
      <ShiftAction
        label={t("mobile.shiftOpen.inbox")}
        onPress={() => {
          push({ name: "inbox" });
        }}
      />
      <ShiftAction
        label={t("mobile.nav.settings")}
        onPress={() => {
          push({ name: "settings" });
        }}
      />
    </AppScrollView>
  );
}
