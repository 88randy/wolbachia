import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { Modal, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { createSheetStyles } from "./sheet-styles.ts";
import { CatalogOptions } from "./CatalogOptions.tsx";
import type { CatalogProps } from "./CatalogOptions.tsx";
interface Props extends CatalogProps {
  readonly isOpen: boolean;
  readonly close: () => void;
}
export function CatalogSheet({ isOpen, close, ...choices }: Props) {
  const t = useT();
  const styles = useStyles(createSheetStyles);
  return (
    <Modal transparent visible={isOpen} onRequestClose={close}>
      <View style={styles.root}>
        <View style={styles.scrim} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <AppText variant="h2" accessibilityRole="header">
            {t("mobile.lifecycle.reason")}
          </AppText>
          <ShiftAction label={t("common.actions.cancel")} onPress={close} />
          <AppScrollView contentContainerStyle={styles.content}>
            <CatalogOptions {...choices} />
          </AppScrollView>
        </View>
      </View>
    </Modal>
  );
}
