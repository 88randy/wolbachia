import { useId } from "react";
import type { ReactNode } from "react";
import { classNames } from "../../styles/class-names";
import { useModalDialog } from "../../session/use-modal-dialog";
import dialog from "../../void/void-dialog.module.css";
import styles from "./permits.module.css";

interface Props {
  title: string;
  description?: string | undefined;
  isBusy: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Modal shell of the permit forms: focus goes in and returns, Escape closes unless busy. */
export function PermitModal({ title, description, isBusy, onClose, children }: Props) {
  const id = useId();
  const ref = useModalDialog("input, textarea, select");
  return (
    <dialog
      ref={ref}
      className={classNames(dialog.dialog, styles.modal)}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!isBusy) onClose();
      }}
    >
      <h2 id={id} className={dialog.title}>
        {title}
      </h2>
      {description !== undefined && <p className={dialog.hint}>{description}</p>}
      {children}
    </dialog>
  );
}
