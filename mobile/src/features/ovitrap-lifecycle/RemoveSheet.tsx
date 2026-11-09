import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { Modal, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { createSheetStyles } from "./sheet-styles.ts";
import { RECOVERY_LABEL } from "./labels.ts";
import type { LifecycleDraft } from "./types.ts";
interface Props {
  readonly isOpen: boolean;
  readonly close: () => void;
  readonly save: () => void;
  readonly isBusy: boolean;
  readonly draft: LifecycleDraft;
}
export function RemoveSheet({ isOpen, close, save, isBusy, draft }: Props) {
  const t = useT();
  const styles = useStyles(createSheetStyles);
  return (
    <Modal transparent visible={isOpen} onRequestClose={close}>
      <View style={styles.root}>
        <View style={styles.scrim} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <AppScrollView contentContainerStyle={styles.content}>
            <AppText variant="h2" accessibilityRole="header">
              {t("mobile.lifecycle.confirmRemove")}
            </AppText>
            <ShiftAction label={t("common.actions.cancel")} disabled={isBusy} onPress={close} />
            <AppText>{draft.point.code}</AppText>
            <AppText>{draft.ovitrapId}</AppText>
            <AppText>
              {draft.recovery ? t(RECOVERY_LABEL[draft.recovery]) : t("mobile.lifecycle.recovery")}
            </AppText>
            <AppText>{t("mobile.lifecycle.removeConsequence")}</AppText>
            <ShiftAction label={t("mobile.lifecycle.remove")} disabled={isBusy} onPress={save} />
          </AppScrollView>
        </View>
      </View>
    </Modal>
  );
}
