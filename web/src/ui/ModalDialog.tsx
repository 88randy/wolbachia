import { cn } from "@/lib/utils";
import { useId } from "react";
import type { ReactNode } from "react";
import { useModalDialog } from "../session/use-modal-dialog";
import styles from "../void/void-dialog.module.css";

const FIRST_CONTROL = "input:not(:disabled), select:not(:disabled), button:not(:disabled)";

interface ModalDialogProps {
  title: string;
  children: ReactNode;
  /** Escape asks to close; while busy the dialog stays open. */
  onClose: () => void;
  isBusy?: boolean;
  /** A wider card for dialogs that hold a form grid. */
  isWide?: boolean;
}

/** A native modal `<dialog>`: mount it to open, unmount it to close; focus returns to the trigger. */
export function ModalDialog({
  title,
  children,
  onClose,
  isBusy = false,
  isWide = false,
}: ModalDialogProps) {
  const titleId = useId();
  const ref = useModalDialog(FIRST_CONTROL);
  return (
    <dialog
      ref={ref}
      className={cn(styles.dialog, isWide && styles.dialogWide)}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!isBusy) onClose();
      }}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      {children}
    </dialog>
  );
}
