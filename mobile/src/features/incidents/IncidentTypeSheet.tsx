import { Modal, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { createIncidentStyles } from "./styles.ts";
import { IncidentTypeOptions } from "./IncidentTypeOptions.tsx";
import type { TypeOptionProps } from "./IncidentTypeOptions.tsx";

export function IncidentTypeSheet(
  props: TypeOptionProps & { readonly isOpen: boolean; readonly close: () => void },
) {
  const t = useT(),
    styles = useStyles(createIncidentStyles);
  return (
    <Modal transparent visible={props.isOpen} onRequestClose={props.close}>
      <View style={styles.sheetRoot}>
        <View style={styles.scrim} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <AppText variant="h2" accessibilityRole="header">
            {t("mobile.incidents.chooseType")}
          </AppText>
          <Button variant="outline" label={t("common.actions.cancel")} onPress={props.close} />
          <AppScrollView keyboardShouldPersistTaps="handled">
            <IncidentTypeOptions {...props} />
          </AppScrollView>
        </View>
      </View>
    </Modal>
  );
}
