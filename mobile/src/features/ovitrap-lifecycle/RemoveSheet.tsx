import { Trash2, X } from "lucide-react-native";
import { Modal, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { createSheetStyles } from "./sheet-styles.ts";
import type { LifecycleDraft } from "./types.ts";

interface Props {
  readonly isOpen: boolean;
  readonly close: () => void;
  readonly save: () => void;
  readonly isBusy: boolean;
  readonly draft: LifecycleDraft;
}

/** "¿Seguro?" before retiring a trap: says which one, what happens, and has a red confirm button. */
export function RemoveSheet({ isOpen, close, save, isBusy, draft }: Props) {
  const t = useT();
  const styles = useStyles(createSheetStyles);
  return (
    <Modal transparent visible={isOpen} onRequestClose={close}>
      <View style={styles.root}>
        <View style={styles.scrim} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <AppText variant="h1" accessibilityRole="header">
            {t("field.lifecycle.confirmTitle")}
          </AppText>
          <AppText variant="bodyStrong">
            {t("field.lifecycle.confirmPoint", { code: draft.point.code })}
          </AppText>
          <AppText>{t("field.lifecycle.removeConsequence")}</AppText>
          <PrimaryButton
            tone="danger"
            icon={Trash2}
            label={t("field.lifecycle.confirmRemove")}
            disabled={isBusy}
            onPress={save}
          />
          <SecondaryButton
            icon={X}
            label={t("field.action.cancel")}
            disabled={isBusy}
            onPress={close}
          />
        </View>
      </View>
    </Modal>
  );
}
