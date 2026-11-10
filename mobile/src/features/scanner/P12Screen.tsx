import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { SupplyActions } from "./SupplyActions.tsx";
import { SupplyDetails } from "./SupplyDetails.tsx";
import { InvalidCode } from "./InvalidCode.tsx";
import { useSupplyDetail } from "./use-supply-detail.ts";

/** P12 displays current downloaded supply provenance without changing custody or quantities. */
export function P12Screen({ lotId }: { readonly lotId: string }) {
  const t = useT();
  const styles = useStyles(createShiftStyles);
  const result = useSupplyDetail(lotId);
  return (
    <View style={styles.root}>
      <ScreenHeader largeTargets title={t("mobile.scanner.supplyTitle")} />
      <AppScrollView contentContainerStyle={styles.content}>
        {result === null ? (
          <Skeleton />
        ) : "error" in result ? (
          <InvalidCode reason={result.error} />
        ) : (
          <SupplyDetails resource={result.resource} />
        )}
      </AppScrollView>
      <SupplyActions isAvailable={result !== null && "resource" in result} />
    </View>
  );
}
