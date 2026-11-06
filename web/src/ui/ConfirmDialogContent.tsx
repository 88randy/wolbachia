import * as Primitive from "@radix-ui/react-dialog";
import { useRef } from "react";
import { ConfirmActions } from "./ConfirmActions";
import styles from "./ui.module.css";
interface ConfirmDialogContentProps {
  title: string;
  consequence: string;
  actionLabel: string;
  onConfirm: () => void;
}
export function ConfirmDialogContent({
  title,
  consequence,
  actionLabel,
  onConfirm,
}: ConfirmDialogContentProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Primitive.Content
      className={styles.dialog}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        cancelRef.current?.focus();
      }}
    >
      <Primitive.Title className={styles.cardTitle}>{title}</Primitive.Title>
      <Primitive.Description className={styles.description}>{consequence}</Primitive.Description>
      <ConfirmActions cancelRef={cancelRef} actionLabel={actionLabel} onConfirm={onConfirm} />
    </Primitive.Content>
  );
}
