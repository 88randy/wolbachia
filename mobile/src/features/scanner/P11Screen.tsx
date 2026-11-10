import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import type { QrKind } from "../ovitrap-check/types.ts";
import { ScannerPreview } from "./ScannerPreview.tsx";
import { ScannerControls } from "./ScannerControls.tsx";
import { useM07 } from "./use-m-07.ts";

/** P11/P21 keep manual entry and recovery in the same originating scanner context. */
export function P11Screen({
  expected,
  eventId,
}: {
  readonly expected?: QrKind;
  readonly eventId?: string | null;
}) {
  const t = useT();
  const styles = useStyles(createShiftStyles);
  const model = useM07(expected, eventId);
  return (
    <View style={styles.root}>
      <ScreenHeader largeTargets title={t("mobile.scanner.title")} />
      <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {model.isLoading ? <Skeleton /> : null}
        <ScannerPreview model={model} />
        <ScannerControls model={model} />
      </AppScrollView>
    </View>
  );
}
