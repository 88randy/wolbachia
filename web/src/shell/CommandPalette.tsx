import * as Dialog from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import { useOverlayFocus } from "./use-overlay-focus";
import { CommandSearch } from "./CommandSearch";
import { CommandPaletteHeader } from "./CommandPaletteHeader";
import type { CommandAction } from "./command-actions";
import styles from "./commands.module.css";
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions?: readonly CommandAction[];
  query?: string;
  onQueryChange?: (query: string) => void;
}
export function CommandPalette(props: CommandPaletteProps) {
  const { open, onOpenChange, actions = [], query, onQueryChange } = props;
  const { t } = useTranslation();
  const { skipRestore, ...focusEvents } = useOverlayFocus();
  const close = (isNavigation = false) => {
    if (isNavigation) skipRestore();
    onOpenChange(false);
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.palette} {...focusEvents}>
          <CommandPaletteHeader />
          <CommandSearch
            actions={actions}
            query={query}
            onQueryChange={onQueryChange}
            onClose={close}
          />
          <Dialog.Close className={styles.close}>{t("common.actions.close")}</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
