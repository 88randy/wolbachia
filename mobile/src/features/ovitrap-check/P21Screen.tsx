import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
export function P21Screen({ target }: { readonly target: "ovitrap" | "bag" }) {
  const t = useT();
  const { push } = useNavigation();
  const styles = useStyles(createShiftStyles);
  const retry = () => {
    push({ name: "ovitrapScanner", target });
  };
  return (
    <View style={styles.root}>
      <ScreenHeader largeTargets title={t("mobile.ovitrap.invalid")} />
      <AppScrollView contentContainerStyle={styles.content}>
        <Notice tone="warning" icon="alert" message={t("mobile.ovitrap.invalidHint")} />
        <ShiftAction label={t("mobile.ovitrap.retry")} onPress={retry} />
        <ShiftAction label={t("mobile.ovitrap.manual")} onPress={retry} />
      </AppScrollView>
    </View>
  );
}
