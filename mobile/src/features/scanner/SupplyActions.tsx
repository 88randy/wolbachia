import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";

export function SupplyActions({ isAvailable }: { readonly isAvailable: boolean }) {
  const t = useT();
  const { push } = useNavigation();
  const styles = useStyles(createShiftStyles);
  return (
    <View style={styles.footer}>
      {isAvailable ? (
        <ShiftAction
          label={t("mobile.scanner.report")}
          onPress={() => {
            push({ name: "incidents" });
          }}
        />
      ) : null}
      <ShiftAction
        label={t("mobile.scanner.retry")}
        onPress={() => {
          push({ name: "qrScanner" });
        }}
      />
    </View>
  );
}
