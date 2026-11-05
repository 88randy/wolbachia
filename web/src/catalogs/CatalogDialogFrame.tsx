import { useId } from "react";
import type { ReactNode } from "react";
import { useCatalogDialog } from "./use-catalog-dialog";
import styles from "./catalogs.module.css";
interface Props {
  title: string;
  isBusy: boolean;
  onCancel: () => void;
  children: ReactNode;
}
/** Native modality with focus trapping, busy close protection and return focus. */
export function CatalogDialogFrame({ title, isBusy, onCancel, children }: Props) {
  const titleId = useId();
  const modal = useCatalogDialog({ initialFocus: "input, button", isBusy, onCancel });
  return (
    <dialog
      ref={modal.ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        modal.cancel();
      }}
      onClose={(event) => {
        modal.onClose(event.currentTarget);
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
