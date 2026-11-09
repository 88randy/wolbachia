import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { CloseContent } from "./CloseContent.tsx";
import { CloseError } from "./CloseError.tsx";
import { useM14 } from "./use-m-14.ts";
export function CloseShiftScreen() {
  const model = useM14();
  const t = useT();
  const styles = useStyles(createShiftStyles);
  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t(
          model.state?.draft?.locallyClosedAt
            ? "mobile.shiftClose.closedTitle"
            : "mobile.shiftClose.title",
        )}
      />
      <View style={styles.footer}>
        <CloseError model={model} />
      </View>
      <CloseContent model={model} />
    </View>
  );
}
