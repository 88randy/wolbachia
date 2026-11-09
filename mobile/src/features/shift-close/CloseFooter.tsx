import { useState } from "react";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { CloseConfirmation } from "./CloseConfirmation.tsx";
import type { M14Model } from "./use-m-14.ts";

export function CloseFooter({ model }: { readonly model: M14Model }) {
  const t = useT();
  const styles = useStyles(createShiftStyles);
  const [isConfirming, setConfirming] = useState(false);
  const cancel = () => {
    setConfirming(false);
  };
  const confirm = () => {
    setConfirming(true);
  };
  return (
    <View style={styles.footer}>
      {isConfirming ? (
        <CloseConfirmation model={model} cancel={cancel} />
      ) : (
        <Button label={t("mobile.shiftClose.continue")} disabled={model.isBusy} onPress={confirm} />
      )}
    </View>
  );
}
