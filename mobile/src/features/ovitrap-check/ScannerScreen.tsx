import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { OvitrapEntry } from "./OvitrapEntry.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { ScannerForm } from "./ScannerForm.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { useM08 } from "./use-m-08.ts";
import { useScannerActions } from "./use-scanner-actions.ts";
export function ScannerScreen({ target }: { readonly target: "ovitrap" | "bag" }) {
  const model = useM08();
  const [code, setCode] = useState("");
  const t = useT();
  const styles = useStyles(createShiftStyles);
  const actions = useScannerActions({ model, target, code });
  return (
    <View style={styles.root}>
      <ScreenHeader
        largeTargets
        title={t(target === "bag" ? "mobile.ovitrap.scanBag" : "mobile.ovitrap.scan")}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {model.errorKey ? <Notice tone="warning" icon="alert" message={t(model.errorKey)} /> : null}
        <ShiftAction
          label={t("mobile.ovitrap.scan")}
          disabled={model.isBusy}
          onPress={actions.scan}
        />
        <ScannerForm code={code} setCode={setCode} isBusy={model.isBusy} enter={actions.enter} />
        <OvitrapEntry labelKey="mobile.ovitrap.resume" />
      </ScrollView>
    </View>
  );
}
