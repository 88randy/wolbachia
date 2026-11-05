import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { useOverlayFocus } from "./use-overlay-focus";
import { ShortcutList } from "./ShortcutList";
import styles from "./commands.module.css";
interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
export function ShortcutsHelp({ open, onOpenChange }: ShortcutsHelpProps) {
  const { t } = useTranslation();
  const { onOpenAutoFocus, onCloseAutoFocus } = useOverlayFocus();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.palette}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <Dialog.Title className={styles.title}>{t("refresh.shortcuts.title")}</Dialog.Title>
          <Dialog.Description className={styles.hint}>
            {t("refresh.shortcuts.hint")}
          </Dialog.Description>
          <ShortcutList />
          <Dialog.Close className={styles.close}>{t("common.actions.close")}</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
