import { useId } from "react";
import type { ReactNode } from "react";
import { useModalDialog } from "../../session/use-modal-dialog";
import styles from "./geography.module.css";
interface Props {
  title: string;
  children: ReactNode;
  onClose: () => void;
  isBusy?: boolean;
}
/** Geography forms reuse the native focus trap/return hook also used by the shared void dialog. */
export function GeographyDialog({ title, children, onClose, isBusy = false }: Props) {
  const id = useId();
  const ref = useModalDialog("input,button");
  const cancel = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!isBusy) onClose();
  };
  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby={id} onCancel={cancel}>
      <h2 id={id}>{title}</h2>
      {children}
    </dialog>
  );
}
